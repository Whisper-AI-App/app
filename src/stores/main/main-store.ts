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
	const filename = mainStore.getCell(
		"aiProviders",
		"whisper-ai",
		"filename",
	) as string | undefined;
	if (filename) {
		return `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${filename}`;
	}
	return undefined;
}

/**
 * Initializes the main store with default values.
 * Called after migrations have run successfully.
 */
export function initMainStore() {
	// placeholder for the future
}
