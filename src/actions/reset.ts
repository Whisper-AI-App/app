import * as FileSystem from "expo-file-system";
import { initStore, store } from "../store";

export function clearConversations() {
	// Delete all chats and messages while keeping settings and model
	store.delTable("chats");
	store.delTable("messages");
}

export async function resetEverything() {
	// Delete downloaded model file before clearing store
	const modelFileUri = store.getValue("ai_chat_model_fileUri") as
		| string
		| undefined;

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
