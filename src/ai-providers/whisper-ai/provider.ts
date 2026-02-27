import * as FileSystem from "expo-file-system";
import { initLlama, type LlamaContext, releaseAllLlama } from "llama.rn";
import type { Store } from "tinybase";
import type { RuntimeConfig, WhisperLLMCard } from "whisper-llm-cards";
import { processSystemMessage } from "whisper-llm-cards";
import type {
	AIProvider,
	CompletionMessage,
	CompletionResult,
	ProviderModel,
} from "../types";
import {
	pauseDownload,
	resumeDownload,
	startDownload,
} from "./download";
import {
	fetchLatestRecommendedModel,
	getStoredModelCard,
} from "./model-config";

const DEFAULT_CONTEXT_SIZE = 2048;

// Module-scoped runtime state
let llamaContext: LlamaContext | null = null;
let runtimeConfig: RuntimeConfig | undefined;
let stopWords: string[] = [];
let currentContextSize = DEFAULT_CONTEXT_SIZE;
let setupPromise: Promise<void> | null = null;

function getModelFileUri(store: Store): string | undefined {
	const filename = store.getCell(
		"aiProviders",
		"whisper-ai",
		"filename",
	) as string | undefined;
	if (filename) {
		return `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${filename}`;
	}
	return undefined;
}

export function createWhisperAIProvider(store: Store): AIProvider {
	const provider: AIProvider = {
		id: "whisper-ai",
		name: "Whisper AI",
		description: "100% private, on-device AI. No internet needed.",
		avatar: require("../../../assets/images/icon.png"),
		type: "local",
		capabilities: {
			oauth: false,
			download: true,
		},

		enable() {
			store.setRow("aiProviders", "whisper-ai", {
				id: "whisper-ai",
				status: "needs_setup",
				error: "",
				selectedModelId: "",
				modelCard: "",
				modelCardId: "",
				configVersion: "",
				downloadedAt: "",
				filename: "",
				progressSizeGB: 0,
				totalSizeGB: 0,
				downloadError: "",
				resumableState: "",
				isPaused: false,
				fileRemoved: false,
				apiKey: "",
				oAuthCodeVerifier: "",
			});
		},

		async disable() {
			// Release llama context
			try {
				await releaseAllLlama();
			} catch (error) {
				console.error("[WhisperAI] Error releasing context on disable", error);
			}
			llamaContext = null;
			runtimeConfig = undefined;
			stopWords = [];
			currentContextSize = DEFAULT_CONTEXT_SIZE;

			// Delete the model file
			const fileUri = getModelFileUri(store);
			if (fileUri) {
				try {
					const file = new FileSystem.File(fileUri);
					if (file.exists) {
						file.delete();
					}
				} catch (error) {
					console.error("[WhisperAI] Error deleting model file", error);
				}
			}

			store.delRow("aiProviders", "whisper-ai");
		},

		async setup() {
			// Already loaded - just sync store status
			if (llamaContext) {
				store.setCell("aiProviders", "whisper-ai", "status", "ready");
				return;
			}

			// Prevent concurrent setup - return existing promise if in progress
			if (setupPromise) return setupPromise;

			const run = async () => {
				const fileUri = getModelFileUri(store);
				const downloadedAt = store.getCell(
					"aiProviders",
					"whisper-ai",
					"downloadedAt",
				) as string | undefined;

				if (!fileUri || !downloadedAt) {
					store.setCell("aiProviders", "whisper-ai", "status", "needs_setup");
					return;
				}

				// Check if file exists
				const file = new FileSystem.File(fileUri);
				if (!file.exists) {
					console.warn(
						"[WhisperAI] GGUF file missing, marking as needs_setup",
						fileUri,
					);
					store.setCell("aiProviders", "whisper-ai", "filename", "");
					store.setCell("aiProviders", "whisper-ai", "downloadedAt", "");
					store.setCell("aiProviders", "whisper-ai", "fileRemoved", true);
					store.setCell("aiProviders", "whisper-ai", "status", "needs_setup");
					return;
				}

				store.setCell("aiProviders", "whisper-ai", "status", "configuring");

				try {
					await releaseAllLlama();
				} catch (error) {
					console.error("[WhisperAI] Trouble releasing existing context", error);
				}

				try {
					// Parse model card to get runtime config
					const cardJson = store.getCell(
						"aiProviders",
						"whisper-ai",
						"modelCard",
					) as string | undefined;
					let runtime: RuntimeConfig | undefined;
					if (cardJson) {
						try {
							const card = JSON.parse(cardJson);
							runtime = card.runtime;
						} catch {
							// ignore
						}
					}

					const isAndroid = process.env.EXPO_OS === "android";

					llamaContext = await initLlama({
						model: fileUri,
						use_mlock: !isAndroid,
						n_ctx: runtime?.n_ctx ?? 4096,
						n_gpu_layers: isAndroid ? 0 : 99,
						flash_attn: runtime?.flash_attn,
						cache_type_k: runtime?.cache_type_k,
						cache_type_v: runtime?.cache_type_v,
					});

					runtimeConfig = runtime;
					currentContextSize = runtime?.n_ctx ?? DEFAULT_CONTEXT_SIZE;
					stopWords = runtime?.stop ?? [];

					store.setCell("aiProviders", "whisper-ai", "status", "ready");
					store.setCell("aiProviders", "whisper-ai", "error", "");
					console.log("[WhisperAI] Model loaded successfully");
				} catch (error) {
					console.error("[WhisperAI] Failed to load model", error);
					const errorMessage =
						error instanceof Error ? error.message : "Failed to load model";
					store.setCell("aiProviders", "whisper-ai", "error", errorMessage);
					store.setCell("aiProviders", "whisper-ai", "status", "error");
					throw error;
				}
			};

			setupPromise = run();
			try {
				await setupPromise;
			} finally {
				setupPromise = null;
			}
		},

		async models(_search?: string) {
			const { config } = await fetchLatestRecommendedModel();
			const models: ProviderModel[] = Object.entries(config.cards).map(
				([id, card]) => ({
					id,
					name: card.name,
					description: `${card.sizeGB.toFixed(1)} GB, ${card.parametersB}B params`,
					contextLength: card.runtime?.n_ctx,
				}),
			);
			return models;
		},

		setModel(modelId: string) {
			store.setCell("aiProviders", "whisper-ai", "selectedModelId", modelId);
		},

		async startDownload(restart?: boolean) {
			const cardJson = store.getCell(
				"aiProviders",
				"whisper-ai",
				"modelCard",
			) as string | undefined;
			const cardId = store.getCell(
				"aiProviders",
				"whisper-ai",
				"modelCardId",
			) as string | undefined;
			const configVersion = store.getCell(
				"aiProviders",
				"whisper-ai",
				"configVersion",
			) as string | undefined;

			if (!cardJson || !cardId || !configVersion) {
				throw new Error("No model card configured for download");
			}

			const card = JSON.parse(cardJson) as WhisperLLMCard;
			await startDownload(store, card, cardId, configVersion, restart);
		},

		pauseDownload() {
			pauseDownload(store);
		},

		async resumeDownload() {
			await resumeDownload(store);
		},

		async completion(
			messages: CompletionMessage[],
			onToken: (token: string) => void,
		): Promise<CompletionResult> {
			if (!llamaContext) {
				return {
					content: "",
					finishReason: "error",
				};
			}

			const runtime = runtimeConfig;
			const sampling = runtime?.sampling ?? {};

			const result = await llamaContext.completion(
				{
					messages,
					n_predict: runtime?.n_predict ?? -1,
					stop: stopWords,
					temperature: sampling.temperature,
					top_k: sampling.top_k,
					top_p: sampling.top_p,
					min_p: sampling.min_p,
					penalty_repeat: sampling.penalty_repeat,
					penalty_last_n: sampling.penalty_last_n,
					seed: sampling.seed,
				},
				(data) => {
					onToken(data.token);
				},
			);

			// Map llama.rn result to unified CompletionResult
			let finishReason: CompletionResult["finishReason"];
			if (result.stopped_eos) {
				finishReason = "stop";
			} else if (result.context_full) {
				finishReason = "length";
			} else {
				finishReason = "length";
			}

			return {
				content: result.content,
				finishReason,
				usage: {
					promptTokens: result.tokens_evaluated,
					completionTokens: result.tokens_predicted,
				},
			};
		},

		stopCompletion() {
			if (llamaContext) {
				llamaContext.stopCompletion();
			}
		},

		isConfigured(): boolean {
			return llamaContext !== null;
		},

		getSystemMessage(conversationMessages: CompletionMessage[]): string {
			const card = getStoredModelCard(store);
			if (card) {
				return processSystemMessage(card, conversationMessages);
			}
			return `You are a 100% private on-device AI chat called Whisper. Conversations stay on the device. Help the user concisely. Be useful, creative, and accurate. Today's date is ${new Date().toLocaleString()}.`;
		},

		getContextSize(): number {
			return currentContextSize;
		},

		async teardown() {
			try {
				await releaseAllLlama();
			} catch (error) {
				console.error("[WhisperAI] Error releasing context", error);
			}
			llamaContext = null;
			runtimeConfig = undefined;
			stopWords = [];
			currentContextSize = DEFAULT_CONTEXT_SIZE;
		},

		async clearCache() {
			if (!llamaContext) return;
			const model = llamaContext.model as {
				is_hybrid?: boolean;
				is_recurrent?: boolean;
			};
			if (model.is_hybrid || model.is_recurrent) {
				await llamaContext.clearCache(false);
				console.log(
					"[WhisperAI] Cache cleared for hybrid/recurrent model",
				);
			}
		},
	};

	return provider;
}
