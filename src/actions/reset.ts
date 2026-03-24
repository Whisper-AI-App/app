import {
	AESEncryptionKey,
	AESSealedData,
	aesDecryptAsync,
} from "expo-crypto";
import * as FileSystem from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import {
	ENCRYPTION_KEY_STORE_ID,
	loadEncryptionKey,
} from "../stores/main/encryption-key";
import {
	getModelFileUri,
	mainStore,
	mainStoreFilePath,
} from "../stores/main/main-store";
import { deleteProviderCredentials } from "./secure-credentials";

async function deleteFileIfExists(uri: string): Promise<void> {
	const file = new FileSystem.File(uri);
	if (file.exists) {
		await file.delete();
	}
}

export function clearConversations() {
	// Delete all chats and messages while keeping settings and providers
	mainStore.delTable("chats");
	mainStore.delTable("messages");
}

export async function resetEverything() {
	// Delete downloaded model file
	const modelFileUri = getModelFileUri();
	if (modelFileUri) {
		await deleteFileIfExists(modelFileUri);
	}

	// Delete store file from disk
	await deleteFileIfExists(mainStoreFilePath);

	// Delete encryption key and all provider credentials from secure store
	await SecureStore.deleteItemAsync(ENCRYPTION_KEY_STORE_ID);
	await deleteProviderCredentials("openrouter");
	await deleteProviderCredentials("custom-provider");
	await deleteProviderCredentials("openai");
	await deleteProviderCredentials("github-copilot");

	mainStore.delValues();
	mainStore.delTables();
}

/**
 * Reads the store file, decrypting if necessary, and returns the JSON string.
 */
async function readStoreContent(): Promise<string> {
	const file = new FileSystem.File(mainStoreFilePath);
	if (!file.exists) {
		throw new Error("No store file found to back up.");
	}

	const keyHex = await loadEncryptionKey();
	if (keyHex) {
		try {
			const bytes = await file.bytes();
			const key = await AESEncryptionKey.import(keyHex, "hex");
			const sealed = AESSealedData.fromCombined(bytes);
			const decrypted = await aesDecryptAsync(sealed, key);
			return new TextDecoder().decode(decrypted);
		} catch {
			// Fall through to plain text read
		}
	}

	return await file.text();
}

/**
 * Shares the store data as a decrypted JSON file via the native share sheet.
 */
export async function saveBackupData(): Promise<void> {
	const content = await readStoreContent();

	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const fileName = `whisper-backup-${timestamp}.json`;
	const cacheDir = new FileSystem.Directory(FileSystem.Paths.cache);
	const tempFile = new FileSystem.File(cacheDir, fileName);
	tempFile.write(content);

	await Sharing.shareAsync(tempFile.uri, {
		mimeType: "application/json",
		dialogTitle: "Save Whisper Backup",
	});
}
