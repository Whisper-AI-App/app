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
	// Delete all chats and messages while keeping settings and model
	mainStore.delTable("chats");
	mainStore.delTable("messages");
}

export async function resetEverything() {
	// Delete downloaded model file
	const modelFileUri = getModelFileUri();
	if (modelFileUri) {
		await deleteFileIfExists(modelFileUri);
	}

	// Delete store files from disk. This is essential when auto-save isn't
	// running (e.g. migration error screen), where in-memory clearing alone
	// would not persist across a reload.
	await deleteFileIfExists(mainStoreFilePath);
	await deleteFileIfExists(mainStoreFilePath.replace(".json", ".backup.json"));

	mainStore.delValues();
	mainStore.delTables();
}

/**
 * Shares the pre-migration backup (or the store file as fallback) as a JSON
 * file via the native share sheet. Called from the migration error screen so
 * users can save their data before deciding to reset.
 */
export async function saveBackupData(): Promise<void> {
	const backupUri = mainStoreFilePath.replace(".json", ".backup.json");

	// Prefer the backup file written before migrations ran; fall back to the
	// main store file (which is also pre-migration since auto-save never ran).
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
