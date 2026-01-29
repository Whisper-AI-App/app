/**
 * TinyBase schema definitions for the Whisper app store.
 *
 * This file is kept separate from store.ts to avoid side effects
 * when importing schemas in tests or mocks.
 */

export const valuesSchemaMainStore = {
	version: { type: "string" as const },
	name: { type: "string" as const },
	onboardedAt: { type: "string" as const },
	theme: { type: "string" as const },
	localAuthEnabled: { type: "boolean" as const },
	// Model card data - stores complete WhisperLLMCard as JSON
	ai_chat_model_card: { type: "string" as const },
	ai_chat_model_cardId: { type: "string" as const },
	ai_chat_model_config_version: { type: "string" as const },
	// Download state
	ai_chat_model_downloadedAt: { type: "string" as const },
	ai_chat_model_filename: { type: "string" as const }, // Just filename, not full path (path changes between app updates)
	ai_chat_model_fileUri: { type: "string" as const }, // Deprecated: kept for backward compatibility
	ai_chat_model_progressSizeGB: { type: "number" as const },
	ai_chat_model_downloadError: { type: "string" as const },
	ai_chat_model_resumableState: { type: "string" as const },
	ai_chat_model_isPaused: { type: "boolean" as const },
	ai_chat_model_fileRemoved: { type: "boolean" as const },
	// Chat background settings
	chat_background_type: { type: "string" as const }, // "default" | "preset" | "custom"
	chat_background_uri: { type: "string" as const }, // URI to background image
	chat_background_preset_id: { type: "string" as const }, // ID of preset if using preset
	chat_background_blur: { type: "number" as const }, // Blur amount (0-20)
	chat_background_grain: { type: "number" as const }, // Grain/noise amount (0-100)
	chat_background_opacity: { type: "number" as const }, // Background opacity (0-100)
	// Game high scores
	flappy_bird_high_score: { type: "number" as const },
	// App icon customization
	app_icon_variant: { type: "string" as const },
};

export const tablesSchemaMainStore = {
	folders: {
		id: { type: "string" as const },
		name: { type: "string" as const },
		createdAt: { type: "string" as const },
	},
	chats: {
		id: { type: "string" as const },
		name: { type: "string" as const },
		createdAt: { type: "string" as const },
		folderId: { type: "string" as const },
	},
	messages: {
		id: { type: "string" as const },
		chatId: { type: "string" as const },
		contents: { type: "string" as const },
		role: { type: "string" as const },
		createdAt: { type: "string" as const },
	},
} as const;
