import type { ImageSource } from "expo-image";
import type { Store } from "tinybase";

export type ProviderStatus =
	| "disabled"
	| "needs_setup"
	| "configuring"
	| "ready"
	| "error";

export interface CompletionMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

export interface CompletionResult {
	content: string;
	finishReason: "stop" | "length" | "error" | "cancelled";
	usage?: {
		promptTokens?: number;
		completionTokens?: number;
	};
}

export interface ProviderModel {
	id: string;
	name: string;
	description?: string;
	contextLength?: number;
}

export interface AIProvider {
	// Identity & metadata
	readonly id: string;
	readonly name: string;
	readonly description: string;
	readonly avatar: ImageSource; // PNG image for UI
	readonly type: "local" | "cloud";
	readonly capabilities: {
		oauth: boolean;
		download: boolean;
	};

	// Lifecycle
	enable(): void;
	disable(): Promise<void>;
	setup(): Promise<void>; // Load model (Whisper) or validate token (OpenRouter)

	// Models
	models(search?: string): Promise<ProviderModel[]>;
	setModel(modelId: string): void;

	// Optional capabilities
	startOAuth?(): Promise<void>;
	handleOAuthCallback?(params: Record<string, string>): Promise<void>;
	startDownload?(restart?: boolean): Promise<void>;
	pauseDownload?(): void;
	resumeDownload?(): Promise<void>;

	// Core
	completion(
		messages: CompletionMessage[],
		onToken: (token: string) => void,
	): Promise<CompletionResult>;
	stopCompletion(): void;

	// Status
	isConfigured(): boolean;

	// Default model to use when none is explicitly selected
	readonly defaultModelId?: string;

	// Per-provider system message
	getSystemMessage(conversationMessages: CompletionMessage[]): string;

	// Context size for truncation
	getContextSize(): number;

	// Cleanup (release LlamaContext, etc.)
	teardown(): Promise<void>;

	// Optional: only for local providers with cache
	clearCache?(): Promise<void>;
}

export type AIProviderFactory = (store: Store) => AIProvider;
