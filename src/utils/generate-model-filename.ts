import type { WhisperLLMCard } from "whisper-llm-cards";

/**
 * Sanitizes a string to be safe for use in filenames
 */
function sanitizeFilename(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with dash
		.replace(/^-+|-+$/g, "") // Remove leading/trailing dashes
		.substring(0, 50); // Limit length
}

/**
 * Generates a short hash from a string (first 6 chars of simple hash)
 */
function generateShortHash(input: string): string {
	let hash = 0;
	for (let i = 0; i < input.length; i++) {
		const char = input.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash).toString(36).substring(0, 6);
}

/**
 * Generates a versioned filename for a model that includes version and content hash
 * Format: modelname-v1.5.0-abc123.gguf
 */
export function generateModelFileName(
	card: WhisperLLMCard,
	version: string,
): string {
	const sanitizedName = sanitizeFilename(card.name);
	const hash = generateShortHash(card.sourceUrl);
	return `${sanitizedName}-v${version}-${hash}.gguf`;
}

/**
 * Parses a model filename to extract version and hash
 * Returns null if filename doesn't match expected format
 */
export function parseModelFileName(
	filename: string,
): { name: string; version: string; hash: string } | null {
	// Match pattern: anything-vX.Y.Z-hash.gguf
	const match = filename.match(/^(.+)-v([\d.]+)-([a-z0-9]+)\.gguf$/i);

	if (!match) {
		return null;
	}

	return {
		name: match[1],
		version: match[2],
		hash: match[3],
	};
}

/**
 * Validates if a filename matches the expected card and version
 */
export function validateModelFileName(
	filename: string,
	expectedCard: WhisperLLMCard,
	expectedVersion: string,
): boolean {
	const parsed = parseModelFileName(filename);
	if (!parsed) {
		return false;
	}

	const expectedHash = generateShortHash(expectedCard.sourceUrl);

	return parsed.version === expectedVersion && parsed.hash === expectedHash;
}
