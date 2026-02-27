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
	// Active AI provider
	activeProviderId: { type: "string" as const },
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
		providerId: { type: "string" as const },
		modelId: { type: "string" as const },
		status: { type: "string" as const },
	},
	aiProviders: {
		id: { type: "string" as const },
		status: { type: "string" as const }, // ProviderStatus
		error: { type: "string" as const }, // Error message when status is "error"
		selectedModelId: { type: "string" as const },
		// Download state (Whisper AI)
		modelCard: { type: "string" as const }, // JSON: WhisperLLMCard
		modelCardId: { type: "string" as const },
		configVersion: { type: "string" as const },
		downloadedAt: { type: "string" as const },
		filename: { type: "string" as const }, // Just filename, path reconstructed at runtime
		progressSizeGB: { type: "number" as const },
		totalSizeGB: { type: "number" as const },
		downloadError: { type: "string" as const },
		resumableState: { type: "string" as const }, // Serialized download resumable
		isPaused: { type: "boolean" as const },
		fileRemoved: { type: "boolean" as const },
		// OAuth state (OpenRouter)
		apiKey: { type: "string" as const },
		oAuthCodeVerifier: { type: "string" as const },
	},
} as const;
