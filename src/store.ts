import * as FileSystem from "expo-file-system";
import { createStore } from "tinybase/with-schemas";

const valuesSchema = {
	version: { type: "string" as const },
	name: { type: "string" as const },
	onboardedAt: { type: "string" as const },
	theme: { type: "string" as const },
	// Model card data - stores complete WhisperLLMCard as JSON
	ai_chat_model_card: { type: "string" as const },
	ai_chat_model_cardId: { type: "string" as const },
	ai_chat_model_config_version: { type: "string" as const },
	// Download state
	ai_chat_model_downloadedAt: { type: "string" as const },
	ai_chat_model_fileUri: { type: "string" as const },
	ai_chat_model_progressSizeGB: { type: "number" as const },
	ai_chat_model_downloadError: { type: "string" as const },
	ai_chat_model_resumableState: { type: "string" as const },
	ai_chat_model_isPaused: { type: "boolean" as const },
	ai_chat_model_fileRemoved: { type: "boolean" as const },
	// Chat background settings
	chat_background_type: { type: "string" as const }, // "default" | "preset" | "custom"
	chat_background_uri: { type: "string" as const }, // URI to background image
	chat_background_preset_id: { type: "string" as const }, // ID of preset if using preset
};

const tablesSchema = {
	chats: {
		id: { type: "string" as const },
		name: { type: "string" as const },
		createdAt: { type: "string" as const },
	},
	messages: {
		id: { type: "string" as const },
		chatId: { type: "string" as const },
		contents: { type: "string" as const },
		role: { type: "string" as const },
		createdAt: { type: "string" as const },
	},
} as const;

export const store = createStore()
	.setValuesSchema(valuesSchema)
	.setTablesSchema(tablesSchema);

export const storeFilePath = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/whisper.json`;

export function initStore() {
	if (
		typeof store.getValue("version") === "undefined" ||
		!store.getValue("version")
	) {
		store.setValue("version", "1");
	}
}
