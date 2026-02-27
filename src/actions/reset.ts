import * as FileSystem from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
	getModelFileUri,
	mainStore,
	mainStoreFilePath,
} from "../stores/main/main-store";

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

	// Delete store files from disk
	await deleteFileIfExists(mainStoreFilePath);
	await deleteFileIfExists(mainStoreFilePath.replace(".json", ".backup.json"));

	mainStore.delValues();
	mainStore.delTables();
}

/**
 * Shares the pre-migration backup (or the store file as fallback) as a JSON
 * file via the native share sheet.
 */
export async function saveBackupData(): Promise<void> {
	const backupUri = mainStoreFilePath.replace(".json", ".backup.json");

	const sourceUri = (await FileSystemLegacy.getInfoAsync(backupUri)).exists
		? backupUri
		: mainStoreFilePath;

	const content = await FileSystemLegacy.readAsStringAsync(sourceUri);

	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const fileName = `whisper-backup-${timestamp}.json`;
	const cacheDir = new FileSystem.Directory(FileSystem.Paths.cache);
	const tempFile = new FileSystem.File(cacheDir, fileName);
	await tempFile.write(content);

	await Sharing.shareAsync(tempFile.uri, {
		mimeType: "application/json",
		dialogTitle: "Save Whisper Backup",
	});
}
