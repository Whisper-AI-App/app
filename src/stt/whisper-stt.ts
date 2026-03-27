import { initWhisper as rnInitWhisper, type WhisperContext } from "whisper.rn";

// Store context instances by id for lookup
const contexts = new Map<number, WhisperContext>();

// Chunked transcription constants
const CHUNK_DURATION_MS = 25_000;
const CHUNK_THRESHOLD_MS = 30_000;

/**
 * Initialize whisper.rn with a model file.
 * The model should be a GGML whisper model (e.g. ggml-tiny.bin).
 * Returns the contextId needed for subsequent calls.
 */
export async function initWhisper(modelPath: string): Promise<number> {
	const ctx = await rnInitWhisper({
		filePath: modelPath,
		isBundleAsset: false,
		useFlashAttn: false,
		useGpu: true,
	});

	contexts.set(ctx.id, ctx);
	return ctx.id;
}

/**
 * Transcribe an audio file to text using the loaded whisper model.
 * For audio longer than CHUNK_THRESHOLD_MS, processes in ~25s segments
 * using whisper.cpp's native offset/duration options.
 *
 * @param contextId - The context handle from initWhisper()
 * @param jobId - Unique job identifier for this transcription
 * @param audioUri - Path to the audio file (WAV preferred)
 * @param durationMs - Optional known duration of the audio in milliseconds
 * @returns Transcribed text string
 */
export async function transcribe(
	contextId: number,
	_jobId: number,
	audioUri: string,
	durationMs?: number,
): Promise<string> {
	const ctx = contexts.get(contextId);
	if (!ctx) {
		throw new Error(`Whisper context ${contextId} not found`);
	}

	console.log("[whisper-stt] Transcribing:", audioUri, durationMs ? `(${durationMs}ms)` : "");

	// Short audio or unknown duration: single-pass transcription
	if (!durationMs || durationMs < CHUNK_THRESHOLD_MS) {
		const { promise } = ctx.transcribe(audioUri, {
			language: "auto",
			translate: false,
			maxThreads: 4,
			temperature: 0.4,
		});

		const result = await promise;

		if (result.isAborted) {
			console.warn("[whisper-stt] Transcription was aborted");
			return "";
		}

		const text = result.result.trim();
		console.log("[whisper-stt] Transcription result:", text ? `"${text}"` : "(empty)");
		return text;
	}

	// Long audio: chunked transcription
	console.log("[whisper-stt] Using chunked transcription for long audio");
	const chunks: string[] = [];
	let offset = 0;

	while (offset < durationMs) {
		const remaining = durationMs - offset;
		const chunkDuration = Math.min(CHUNK_DURATION_MS, remaining);

		console.log(`[whisper-stt] Chunk at offset=${offset}ms, duration=${chunkDuration}ms`);

		const { promise } = ctx.transcribe(audioUri, {
			language: "auto",
			translate: false,
			maxThreads: 4,
			temperature: 0.4,
			offset,
			duration: chunkDuration,
		});

		const result = await promise;

		if (result.isAborted) {
			console.warn("[whisper-stt] Chunked transcription was aborted at offset", offset);
			break;
		}

		const chunkText = result.result.trim();
		if (chunkText) {
			chunks.push(chunkText);
		}

		offset += CHUNK_DURATION_MS;
	}

	const text = mergeChunks(chunks);
	console.log("[whisper-stt] Chunked transcription result:", text ? `"${text.slice(0, 100)}..."` : "(empty)");
	return text;
}

/**
 * Merge chunk texts, deduplicating overlapping words at boundaries.
 */
function mergeChunks(chunks: string[]): string {
	if (chunks.length === 0) return "";
	if (chunks.length === 1) return chunks[0];

	let merged = chunks[0];
	for (let i = 1; i < chunks.length; i++) {
		const prev = merged;
		const next = chunks[i];

		// Check for overlap: compare last few words of prev with first few words of next
		const prevWords = prev.split(/\s+/);
		const nextWords = next.split(/\s+/);
		const maxOverlap = Math.min(5, prevWords.length, nextWords.length);

		let overlapLen = 0;
		for (let len = maxOverlap; len >= 1; len--) {
			const tail = prevWords.slice(-len).join(" ").toLowerCase();
			const head = nextWords.slice(0, len).join(" ").toLowerCase();
			if (tail === head) {
				overlapLen = len;
				break;
			}
		}

		if (overlapLen > 0) {
			merged = prev + " " + nextWords.slice(overlapLen).join(" ");
		} else {
			merged = prev + " " + next;
		}
	}

	return merged.trim();
}

/**
 * Release the whisper context and free memory (~75MB).
 * @param contextId - The context handle from initWhisper()
 */
export async function release(contextId: number): Promise<void> {
	const ctx = contexts.get(contextId);
	if (!ctx) return;
	try {
		await ctx.release();
	} catch {
		// Ignore errors on release
	}
	contexts.delete(contextId);
}
