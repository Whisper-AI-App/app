/**
 * Wipes the local development caching proxy's cache directory.
 *
 * Pairs with `scripts/caching-proxy.ts`. Use this when you want to force a
 * fresh download on the next emulator run, or when cached responses have
 * become stale.
 */

import { existsSync, rmSync, statSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const CACHE_DIR = join(process.cwd(), ".cache");

function formatBytes(bytes: number): string {
	if (!bytes) return "0 B";
	const gb = bytes / 1024 ** 3;
	if (gb >= 1) return `${gb.toFixed(2)} GB`;
	const mb = bytes / 1024 ** 2;
	if (mb >= 1) return `${mb.toFixed(2)} MB`;
	const kb = bytes / 1024;
	return `${kb.toFixed(2)} KB`;
}

function directorySize(dir: string): number {
	let total = 0;
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) {
			total += directorySize(full);
		} else {
			total += statSync(full).size;
		}
	}
	return total;
}

if (!existsSync(CACHE_DIR)) {
	console.info(`[cache] nothing to clear: ${CACHE_DIR} does not exist`);
	process.exit(0);
}

const sizeBefore = directorySize(CACHE_DIR);
rmSync(CACHE_DIR, { recursive: true, force: true });
console.info(`[cache] cleared ${formatBytes(sizeBefore)} from ${CACHE_DIR}`);
