/**
 * Local caching HTTP proxy for development on emulators/simulators.
 *
 * Emulators re-download large GGUF model files on every fresh install, which
 * is slow and wastes bandwidth. This proxy sits in front of HuggingFace (and
 * any other model host) and caches responses to `.cache/` keyed by URL.
 *
 * The app routes downloads through this proxy in dev mode only, via
 * `src/utils/dev-proxy.ts`'s `maybeProxyUrl()`. Physical devices and
 * production builds bypass the proxy entirely.
 *
 * Usage:
 *   npm run caching           # start the proxy (foreground)
 *   npm run caching:clear     # wipe the cache directory
 *
 * Request shape:
 *   GET http://localhost:8787/proxy?url=<encoded upstream URL>
 *
 * Features:
 *   - Streams cache writes to disk (no buffering huge files in memory)
 *   - Forwards Authorization header to upstream (gated HF models)
 *   - Follows redirects (HF returns 302 to cdn-lfs.hf.co)
 *   - Serves Range requests from cache (resumable downloads)
 *   - Atomic writes via `.partial` + rename
 */

import { createHash } from "node:crypto";
import {
	createReadStream,
	createWriteStream,
	existsSync,
	mkdirSync,
	readFileSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { rename } from "node:fs/promises";
import {
	createServer,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";

const PORT = 8787;
const CACHE_DIR = join(process.cwd(), ".cache");

if (!existsSync(CACHE_DIR)) {
	mkdirSync(CACHE_DIR, { recursive: true });
}

// Track URLs currently being fetched so we don't try to cache them twice.
const inFlight = new Set<string>();

interface CacheMeta {
	url: string;
	contentType: string;
	contentLength: string | null;
	savedAt: string;
}

function keyForUrl(url: string): string {
	return createHash("sha256").update(url).digest("hex");
}

function cachePathForKey(key: string): string {
	return join(CACHE_DIR, key);
}

function metaPathForKey(key: string): string {
	return join(CACHE_DIR, `${key}.meta.json`);
}

function formatBytes(bytes: number): string {
	if (!bytes) return "0 B";
	const gb = bytes / 1024 ** 3;
	if (gb >= 1) return `${gb.toFixed(2)} GB`;
	const mb = bytes / 1024 ** 2;
	if (mb >= 1) return `${mb.toFixed(2)} MB`;
	const kb = bytes / 1024;
	return `${kb.toFixed(2)} KB`;
}

function parseRangeHeader(
	header: string | undefined,
	fileSize: number,
): { start: number; end: number } | null {
	if (!header) return null;
	const match = /bytes=(\d*)-(\d*)/.exec(header);
	if (!match) return null;
	const start = match[1] ? Number.parseInt(match[1], 10) : 0;
	const end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;
	if (
		Number.isNaN(start) ||
		Number.isNaN(end) ||
		start > end ||
		start >= fileSize
	) {
		return null;
	}
	return { start, end: Math.min(end, fileSize - 1) };
}

function readMeta(metaPath: string): CacheMeta | null {
	try {
		return JSON.parse(readFileSync(metaPath, "utf8")) as CacheMeta;
	} catch {
		return null;
	}
}

async function serveFromCache(
	req: IncomingMessage,
	res: ServerResponse,
	cachePath: string,
	metaPath: string,
): Promise<void> {
	const meta = readMeta(metaPath);
	const stat = statSync(cachePath);
	const size = stat.size;
	const contentType = meta?.contentType || "application/octet-stream";

	const range = parseRangeHeader(req.headers.range, size);
	if (range) {
		const { start, end } = range;
		const chunkSize = end - start + 1;
		res.writeHead(206, {
			"Content-Range": `bytes ${start}-${end}/${size}`,
			"Accept-Ranges": "bytes",
			"Content-Length": String(chunkSize),
			"Content-Type": contentType,
		});
		await pipeline(createReadStream(cachePath, { start, end }), res);
		return;
	}

	res.writeHead(200, {
		"Content-Length": String(size),
		"Accept-Ranges": "bytes",
		"Content-Type": contentType,
	});
	await pipeline(createReadStream(cachePath), res);
}

async function fetchAndMaybeCache(
	req: IncomingMessage,
	res: ServerResponse,
	upstreamUrl: string,
	cachePath: string,
	metaPath: string,
): Promise<void> {
	const key = keyForUrl(upstreamUrl);

	// Only cache complete downloads (no Range header) and only one at a time
	// per URL. Range requests and concurrent fetches are passed through.
	const canCache = !req.headers.range && !inFlight.has(key);

	// Forward a minimal set of headers to the upstream. We explicitly ask for
	// `identity` encoding so Node's fetch doesn't auto-decompress a body whose
	// content-length header we're about to pass through (that mismatch would
	// truncate the response on the client side).
	const forwardHeaders: Record<string, string> = {
		"accept-encoding": "identity",
	};
	if (req.headers.authorization) {
		forwardHeaders.authorization = req.headers.authorization as string;
	}
	if (req.headers.range) {
		forwardHeaders.range = req.headers.range as string;
	}

	const rangeLabel = req.headers.range ? ` (range: ${req.headers.range})` : "";
	console.info(`[cache] FETCH ${upstreamUrl}${rangeLabel}`);

	const upstreamRes = await fetch(upstreamUrl, {
		headers: forwardHeaders,
		redirect: "follow",
	});

	if (!upstreamRes.ok && upstreamRes.status !== 206) {
		res.writeHead(upstreamRes.status, { "Content-Type": "text/plain" });
		res.end(
			`Upstream error: ${upstreamRes.status} ${upstreamRes.statusText}\n`,
		);
		return;
	}

	const contentLength = upstreamRes.headers.get("content-length");
	const contentType =
		upstreamRes.headers.get("content-type") || "application/octet-stream";
	const contentRange = upstreamRes.headers.get("content-range");

	const respHeaders: Record<string, string> = {
		"Content-Type": contentType,
		"Accept-Ranges": "bytes",
	};
	if (contentLength) respHeaders["Content-Length"] = contentLength;
	if (contentRange) respHeaders["Content-Range"] = contentRange;
	res.writeHead(upstreamRes.status, respHeaders);

	if (!upstreamRes.body) {
		res.end();
		return;
	}

	const nodeStream = Readable.fromWeb(
		upstreamRes.body as unknown as WebReadableStream<Uint8Array>,
	);

	if (!canCache) {
		await pipeline(nodeStream, res);
		return;
	}

	inFlight.add(key);
	const partialPath = `${cachePath}.partial`;
	const diskStream = createWriteStream(partialPath);

	// Capture disk errors asynchronously so we can surface them from the pump.
	let diskError: Error | null = null;
	diskStream.on("error", (err) => {
		diskError = err;
	});

	try {
		// Manual tee: pump chunks from upstream to both the response and the
		// on-disk partial. The two sinks have independent lifecycles — if the
		// client disconnects mid-download we still finish writing the cache,
		// and if the disk write fails we still try to satisfy the client.
		for await (const chunk of nodeStream) {
			if (diskError) throw diskError;

			if (!diskStream.write(chunk)) {
				await new Promise<void>((resolve, reject) => {
					const onDrain = () => {
						diskStream.off("error", onError);
						resolve();
					};
					const onError = (err: Error) => {
						diskStream.off("drain", onDrain);
						reject(err);
					};
					diskStream.once("drain", onDrain);
					diskStream.once("error", onError);
				});
			}

			if (!res.closed && !res.errored) {
				if (!res.write(chunk)) {
					await new Promise<void>((resolve) => {
						const done = () => {
							res.off("drain", done);
							res.off("close", done);
							resolve();
						};
						res.once("drain", done);
						res.once("close", done);
					});
				}
			}
		}

		// Close the response first (client-facing path); the disk write is
		// finalized separately so its completion isn't tied to the client.
		if (!res.writableEnded) res.end();

		await new Promise<void>((resolve, reject) => {
			diskStream.end(() => {
				if (diskError) reject(diskError);
				else resolve();
			});
		});

		// Promote the partial file to the canonical cache entry.
		await rename(partialPath, cachePath);
		const savedBytes = statSync(cachePath).size;
		const meta: CacheMeta = {
			url: upstreamUrl,
			contentType,
			contentLength: contentLength ?? String(savedBytes),
			savedAt: new Date().toISOString(),
		};
		writeFileSync(metaPath, JSON.stringify(meta, null, 2));
		console.info(
			`[cache] SAVED ${formatBytes(savedBytes)} ${upstreamUrl}`,
		);
	} catch (err) {
		console.error("[cache] download failed, discarding partial:", err);
		diskStream.destroy();
		try {
			unlinkSync(partialPath);
		} catch {
			// ignore
		}
		if (!res.writableEnded) {
			try {
				res.end();
			} catch {
				// ignore
			}
		}
	} finally {
		inFlight.delete(key);
	}
}

async function handleRequest(
	req: IncomingMessage,
	res: ServerResponse,
): Promise<void> {
	const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

	if (url.pathname === "/") {
		res.writeHead(200, { "Content-Type": "text/plain" });
		res.end(
			"whisper caching proxy\nUsage: GET /proxy?url=<encoded upstream URL>\n",
		);
		return;
	}

	if (url.pathname !== "/proxy") {
		res.writeHead(404, { "Content-Type": "text/plain" });
		res.end("Not found. Use /proxy?url=<upstream>\n");
		return;
	}

	const upstreamUrl = url.searchParams.get("url");
	if (!upstreamUrl) {
		res.writeHead(400, { "Content-Type": "text/plain" });
		res.end("Missing 'url' query param\n");
		return;
	}

	const key = keyForUrl(upstreamUrl);
	const cachePath = cachePathForKey(key);
	const metaPath = metaPathForKey(key);

	try {
		if (existsSync(cachePath)) {
			const rangeLabel = req.headers.range
				? ` (range: ${req.headers.range})`
				: "";
			console.info(`[cache] HIT  ${upstreamUrl}${rangeLabel}`);
			await serveFromCache(req, res, cachePath, metaPath);
			return;
		}
		console.info(`[cache] MISS ${upstreamUrl}`);
		await fetchAndMaybeCache(req, res, upstreamUrl, cachePath, metaPath);
	} catch (err) {
		console.error("[cache] error handling request:", err);
		if (!res.headersSent) {
			res.writeHead(500, { "Content-Type": "text/plain" });
			res.end(`Proxy error: ${String(err)}\n`);
		} else {
			res.destroy();
		}
	}
}

const server = createServer((req, res) => {
	handleRequest(req, res).catch((err) => {
		console.error("[cache] unhandled:", err);
	});
});

server.listen(PORT, () => {
	console.info(`[cache] Caching proxy listening on http://localhost:${PORT}`);
	console.info(`[cache] Cache dir: ${CACHE_DIR}`);
	console.info("[cache] Ctrl-C to stop");
});

process.on("SIGINT", () => {
	console.info("\n[cache] shutting down");
	server.close(() => process.exit(0));
});
