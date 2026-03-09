import {
	AESEncryptionKey,
	AESSealedData,
	aesDecryptAsync,
	aesEncryptAsync,
} from "expo-crypto";
import * as FileSystem from "expo-file-system";
import type { Persister, Persists } from "tinybase/persisters";
import { createCustomPersister } from "tinybase/persisters";
import type { Store } from "tinybase";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const jsonParse = (json: string) => {
	return JSON.parse(json, (_key, value) =>
		value === null ? undefined : value,
	);
};

const jsonStringify = (obj: unknown): string => {
	return JSON.stringify(obj, (_key, value) =>
		value === undefined ? null : value,
	);
};

export interface ExpoFileSystemPersister
	extends Persister<Persists.StoreOnly> {
	getFilePath(): string;
	setEncryptionKey(keyHex: string): void;
}

/**
 * Creates a TinyBase persister backed by the Expo file system.
 *
 * When `encryptionKeyHex` is provided:
 *   Save: JSON.stringify → AES-256-GCM encrypt → write bytes
 *   Load: read bytes → AES decrypt → JSON.parse (with plain JSON fallback)
 *
 * When `encryptionKeyHex` is null:
 *   Save: JSON.stringify → write text
 *   Load: read text → JSON.parse
 */
export function createExpoFileSystemPersister(
	store: Store,
	filePath: string,
	encryptionKeyHex: string | null,
	onIgnoredError?: (error: unknown) => void,
): ExpoFileSystemPersister {
	const file = new FileSystem.File(filePath);
	let currentKeyHex = encryptionKeyHex;

	async function encrypt(plaintext: string): Promise<Uint8Array> {
		const key = await AESEncryptionKey.import(currentKeyHex!, "hex");
		const sealed = await aesEncryptAsync(encoder.encode(plaintext), key);
		return await sealed.combined();
	}

	async function decrypt(data: Uint8Array): Promise<string> {
		const key = await AESEncryptionKey.import(currentKeyHex!, "hex");
		const sealed = AESSealedData.fromCombined(data);
		const decrypted = await aesDecryptAsync(sealed, key);
		return decoder.decode(decrypted);
	}

	const getPersisted = async () => {
		try {
			if (!file.exists) return undefined;

			if (currentKeyHex !== null) {
				// Try encrypted bytes first, fall back to plain JSON (pre-migration)
				try {
					const bytes = await file.bytes();
					const json = await decrypt(bytes);
					return jsonParse(json);
				} catch {
					try {
						const text = await file.text();
						return jsonParse(text);
					} catch (fallbackError) {
						onIgnoredError?.(fallbackError);
						return undefined;
					}
				}
			}

			// Plain mode
			const text = await file.text();
			return jsonParse(text);
		} catch (error) {
			onIgnoredError?.(error);
			return undefined;
		}
	};

	const setPersisted = async (
		getContent: () => unknown,
	): Promise<void> => {
		const content = getContent();
		const json = jsonStringify(content);

		if (currentKeyHex !== null) {
			const encrypted = await encrypt(json);
			await file.write(encrypted);
		} else {
			await file.write(json);
		}
	};

	let lastModified: number | null = null;

	const addPersisterListener = (
		listener: () => void,
	): ReturnType<typeof setInterval> => {
		// Ensure file exists for modification time tracking
		(async () => {
			try {
				if (!file.exists) {
					await file.write("");
				}
			} catch (error) {
				onIgnoredError?.(error);
			}
		})();

		const intervalId = setInterval(async () => {
			try {
				const info = new FileSystem.File(filePath).info();
				if (info.exists && "modificationTime" in info) {
					const currentModified = info.modificationTime;
					if (
						lastModified !== null &&
						currentModified !== lastModified
					) {
						listener();
					}
					lastModified = (currentModified as number) ?? null;
				}
			} catch (error) {
				onIgnoredError?.(error);
			}
		}, 1000);

		return intervalId;
	};

	const delPersisterListener = (
		intervalId: ReturnType<typeof setInterval>,
	): void => {
		if (intervalId) {
			clearInterval(intervalId);
		}
	};

	const persister = createCustomPersister(
		store,
		getPersisted,
		setPersisted,
		addPersisterListener,
		delPersisterListener,
		onIgnoredError,
	) as Persister<Persists.StoreOnly>;

	return Object.create(Object.getPrototypeOf(persister), {
		...Object.getOwnPropertyDescriptors(persister),
		getFilePath: {
			value: () => filePath,
			writable: true,
			enumerable: true,
			configurable: true,
		},
		setEncryptionKey: {
			value: (keyHex: string) => {
				currentKeyHex = keyHex;
			},
			writable: true,
			enumerable: true,
			configurable: true,
		},
	});
}
