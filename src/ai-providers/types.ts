import type { ImageSource } from "expo-image";
import type { Store } from "tinybase";

export type ProviderStatus =
	| "disabled"
	| "needs_setup"
	| "configuring"
	| "ready"
	| "error";

// ─── Multimodal Message Parts ─────────────────────────────────

export type CompletionMessagePart =
	| TextMessagePart
	| ImageMessagePart
	| AudioMessagePart
	| FileMessagePart;

export interface TextMessagePart {
	type: "text";
	text: string;
}

export interface ImageMessagePart {
	type: "image";
	uri: string;
	mimeType: string;
	alt: string;
}

export interface AudioMessagePart {
	type: "audio";
	uri: string;
	format: "wav" | "mp3";
	alt: string;
}

export interface FileMessagePart {
	type: "file";
	uri: string;
	mimeType: string;
	fileName: string;
	alt: string;
}

// ─── Multimodal Capabilities ──────────────────────────────────

export interface MultimodalConstraints {
	maxImageWidth: number;
	maxImageHeight: number;
	imageMaxTokens?: number;
	maxFileSize: number;
	maxAudioDuration: number;
	supportedImageFormats: string[];
	supportedFileTypes: string[];
	audioFormat: "wav" | "mp3";
	audioSampleRate: number;
}

export interface MultimodalCapabilities {
	vision: boolean;
	audio: boolean;
	files: boolean;
	constraints: MultimodalConstraints;
}

export const NO_MULTIMODAL: MultimodalCapabilities = {
	vision: false,
	audio: false,
	files: false,
	constraints: {
		maxImageWidth: 0,
		maxImageHeight: 0,
		maxFileSize: 0,
		maxAudioDuration: 0,
		supportedImageFormats: [],
		supportedFileTypes: [],
		audioFormat: "wav",
		audioSampleRate: 16000,
	},
};

export const DEFAULT_CONSTRAINTS: MultimodalConstraints = {
	maxImageWidth: 1024,
	maxImageHeight: 1024,
	maxFileSize: 10 * 1024 * 1024, // 10 MB
	maxAudioDuration: 300, // 5 minutes
	supportedImageFormats: ["jpeg", "png"],
	supportedFileTypes: ["txt", "md", "json", "csv"],
	audioFormat: "wav",
	audioSampleRate: 16000,
};

// ─── Attachment Types ─────────────────────────────────────────

export interface PendingAttachment {
	id: string;
	type: "image" | "file" | "audio";
	uri: string;
	mimeType: string;
	fileName: string;
	fileSize: number;
	width?: number;
	height?: number;
	duration?: number;
	/** Pre-computed transcription (eager STT started on recording stop). */
	transcription?: string;
}

export interface ProcessedAttachment {
	id: string;
	type: "image" | "file" | "audio";
	uri: string;
	mimeType: string;
	fileName: string;
	fileSize: number;
	width: number;
	height: number;
	duration: number;
	alt: string;
	thumbnailUri: string;
}

// ─── Memory Management Types ─────────────────────────────────

export type CapabilityMemoryStatus =
	| "unloaded"
	| "loading"
	| "ready"
	| "releasing"
	| "budget_denied";

export interface CapabilityMemoryState {
	vision: CapabilityMemoryStatus;
	stt: CapabilityMemoryStatus;
}

export type CapabilityEvent =
	| { type: "USER_REQUEST" }
	| { type: "PRE_WARM" }
	| { type: "LOAD_SUCCESS" }
	| { type: "LOAD_FAIL_BUDGET" }
	| { type: "LOAD_FAIL_ERROR"; error: string }
	| { type: "MEMORY_PRESSURE" }
	| { type: "TEARDOWN" }
	| { type: "RELEASE_COMPLETE" }
	| { type: "RETRY" };

export type DeviceMemoryTier =
	| "minimal"
	| "conservative"
	| "balanced"
	| "full"
	| "unrestricted";

export interface MemoryBudgetResult {
	canLoad: boolean;
	availableBytes: number;
	estimatedModelBytes: number;
	source: "native" | "fallback";
}

export interface OnDemandLoadConfig {
	preWarmMinRAM: {
		vision: number;
		stt: number;
	};
	headroomFactor: number;
	postTeardownSettleMs: number;
}

export const DEFAULT_LOAD_CONFIG: OnDemandLoadConfig = {
	preWarmMinRAM: {
		vision: 8,
		stt: 6,
	},
	headroomFactor: 1.3,
	postTeardownSettleMs: 100,
};

export interface TierStrategy {
	maxChatModelGB: number;
	preWarmVision: boolean;
	preWarmSTT: boolean;
	allowOnDemandVision: boolean;
	allowOnDemandSTT: boolean;
}

export const TIER_STRATEGIES: Record<DeviceMemoryTier, TierStrategy> = {
	minimal: {
		maxChatModelGB: 0.5,
		preWarmVision: false,
		preWarmSTT: false,
		allowOnDemandVision: false,
		allowOnDemandSTT: true,
	},
	conservative: {
		maxChatModelGB: 1.5,
		preWarmVision: false,
		preWarmSTT: false,
		allowOnDemandVision: false,
		allowOnDemandSTT: true,
	},
	balanced: {
		maxChatModelGB: 2.0,
		preWarmVision: false,
		preWarmSTT: true,
		allowOnDemandVision: true,
		allowOnDemandSTT: true,
	},
	full: {
		maxChatModelGB: 4.0,
		preWarmVision: true,
		preWarmSTT: true,
		allowOnDemandVision: true,
		allowOnDemandSTT: true,
	},
	unrestricted: {
		maxChatModelGB: 8.0,
		preWarmVision: true,
		preWarmSTT: true,
		allowOnDemandVision: true,
		allowOnDemandSTT: true,
	},
};

// ─── Messages ─────────────────────────────────────────────────

export interface CompletionMessage {
	role: "user" | "assistant" | "system";
	content: string | CompletionMessagePart[];
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
		modelBrowsing?: boolean;
		userApiKey: boolean;
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
	startDownload?(restart?: boolean): Promise<boolean | void>;
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

	// Optional: delete a downloaded model and its files
	deleteModel?(modelId: string): Promise<void>;

	// Multimodal support
	getMultimodalCapabilities(): MultimodalCapabilities;
	preprocessMedia?(
		attachments: PendingAttachment[],
		capabilities: MultimodalCapabilities,
	): Promise<ProcessedAttachment[]>;
}

export type AIProviderFactory = (store: Store) => AIProvider;
