/**
 * Mock for expo-crypto AES operations in tests.
 *
 * Uses a simple prefix-based transform instead of real encryption
 * so tests can verify the persister calls encrypt/decrypt without native modules.
 */

const MOCK_PREFIX = "encrypted:";

export const aesEncryptAsync = jest.fn(
	async (plaintext: Uint8Array | string, _key: object) => {
		const text =
			plaintext instanceof Uint8Array
				? new TextDecoder().decode(plaintext)
				: plaintext;
		return {
			combined: async () =>
				new TextEncoder().encode(`${MOCK_PREFIX}${text}`),
			combinedSize: MOCK_PREFIX.length + text.length,
		};
	},
);

export const aesDecryptAsync = jest.fn(
	async (
		sealed: Uint8Array,
		_key: object,
		_opts?: { output?: string },
	): Promise<Uint8Array> => {
		const text = new TextDecoder().decode(sealed);
		if (!text.startsWith(MOCK_PREFIX)) {
			throw new Error("Decryption failed: invalid sealed data");
		}
		return new TextEncoder().encode(text.slice(MOCK_PREFIX.length));
	},
);

export const AESEncryptionKey = {
	generate: jest.fn(async () => ({
		encoded: async (encoding: string) =>
			encoding === "hex" ? "a".repeat(64) : btoa("a".repeat(32)),
		bytes: async () => new Uint8Array(32).fill(0xaa),
		size: 256,
	})),
	import: jest.fn(async (_input: string | Uint8Array, _format?: string) => ({
		encoded: async (encoding: string) =>
			encoding === "hex"
				? typeof _input === "string"
					? _input
					: "a".repeat(64)
				: btoa("a".repeat(32)),
		bytes: async () => new Uint8Array(32).fill(0xaa),
		size: 256,
	})),
};

export const AESSealedData = {
	fromCombined: jest.fn((bytes: Uint8Array | string) =>
		typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes,
	),
};

// Re-export other expo-crypto APIs that may be needed
export const CryptoDigestAlgorithm = {
	SHA256: "SHA-256",
};

export function getRandomBytes(byteCount: number): Uint8Array {
	return new Uint8Array(byteCount).fill(42);
}

export async function digest(
	_algorithm: string,
	_data: Uint8Array,
): Promise<ArrayBuffer> {
	// Return a deterministic ArrayBuffer for testing
	return new Uint8Array(32).fill(0xab).buffer;
}
