import * as FileSystem from "expo-file-system";
import { createStore } from "tinybase/with-schemas";
import { tablesSchemaMainStore, valuesSchemaMainStore } from "./schema";

export const mainStore = createStore()
	.setValuesSchema(valuesSchemaMainStore)
	.setTablesSchema(tablesSchemaMainStore);

export const mainStoreFilePath = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/whisper.json`;

/**
 * Gets the full file URI for the AI model from the stored filename.
 * This reconstructs the path at runtime since the document directory path
 * can change between app updates.
 */
export function getModelFileUri(): string | undefined {
	const filename = mainStore.getValue("ai_chat_model_filename") as
		| string
		| undefined;
	if (filename) {
		return `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${filename}`;
	}
	// Fallback to legacy fileUri for migration
	return mainStore.getValue("ai_chat_model_fileUri") as string | undefined;
}

export function initMainStore() {
	if (
		typeof mainStore.getValue("version") === "undefined" ||
		!mainStore.getValue("version")
	) {
		mainStore.setValue("version", "1");
	}
}
