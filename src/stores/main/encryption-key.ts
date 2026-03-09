import { AESEncryptionKey } from "expo-crypto";
import * as SecureStore from "expo-secure-store";

export const ENCRYPTION_KEY_STORE_ID = "whisper_encryption_key";

const VALID_HEX_KEY_REGEX = /^[0-9a-f]{64}$/;

/**
 * Generates a new AES-256 encryption key, stores it in secure storage,
 * and returns the hex-encoded key string.
 */
export async function generateEncryptionKey(): Promise<string> {
	const key = await AESEncryptionKey.generate();
	const hex = await key.encoded("hex");
	await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE_ID, hex);
	return hex;
}

/**
 * Loads the encryption key from secure storage.
 * Returns null if the key doesn't exist or is corrupted.
 */
export async function loadEncryptionKey(): Promise<string | null> {
	const hex = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE_ID);
	if (!hex || !VALID_HEX_KEY_REGEX.test(hex)) {
		return null;
	}
	return hex;
}
