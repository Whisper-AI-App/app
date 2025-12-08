import * as FileSystem from "expo-file-system";
import { getModelFileUri, initStore, store } from "../store";

export function clearConversations() {
	// Delete all chats and messages while keeping settings and model
	store.delTable("chats");
	store.delTable("messages");
}

export async function resetEverything() {
	// Delete downloaded model file before clearing store
	// Use helper to reconstruct path from filename (handles app updates)
	const modelFileUri = getModelFileUri();

	if (modelFileUri) {
		const file = new FileSystem.File(modelFileUri);
		if (file.exists) {
			await file.delete();
		}
	}

	store.delValues();
	store.delTables();
	initStore();
}
