import {
	deleteProviderCredentials,
	getCredential,
} from "@/src/actions/secure-credentials";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { ModelMessage } from "ai";
import { streamText } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import type { Store } from "tinybase";
import type {
	AIProvider,
	CompletionMessage,
	CompletionMessagePart,
	CompletionResult,
	MultimodalCapabilities,
	ProviderModel,
} from "../types";
import { DEFAULT_CONSTRAINTS, NO_MULTIMODAL } from "../types";
import { convertMessagesForAISDK } from "../message-converter";
import { convertToAISDKTools } from "../tool-converter";
import type { ToolDefinition } from "../../tools/types";
import { handleOAuthCallback, startOAuth } from "./oauth";
import { getCapabilityStatus, dispatch } from "../../memory/state";
import { initSTT } from "../../stt";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const OPENROUTER_AUTH_KEY_URL = "https://openrouter.ai/api/v1/auth/key";
const DEFAULT_CLOUD_CONTEXT_SIZE = 128000;

interface CachedModelInfo extends ProviderModel {
	inputModalities?: string[];
}

// Module-scoped runtime state
let abortController: AbortController | null = null;
let cachedModels: CachedModelInfo[] = [];

export function createOpenRouterProvider(store: Store): AIProvider {
	// Cache the API key in memory for synchronous access
	let cachedApiKey = "";

	let capabilitiesVersion = 0;
	function updateCapabilitiesVersion() {
		store.setCell("aiProviders", "openrouter", "capabilitiesVersion", ++capabilitiesVersion);
	}

	async function refreshApiKey(): Promise<string> {
		cachedApiKey = (await getCredential("openrouter", "apiKey")) ?? "";
		return cachedApiKey;
	}

	function getApiKey(): string {
		return cachedApiKey;
	}

	function getSelectedModelId(): string {
		return (
			(store.getCell(
				"aiProviders",
				"openrouter",
				"selectedModelId",
			) as string) || ""
		);
	}

	const provider: AIProvider = {
		id: "openrouter",
		name: "OpenRouter",
		description: "Access hundreds of cloud AI models via OpenRouter.",
		avatar: require("../../../assets/images/ai-providers/openrouter.png"),
		type: "cloud",
		defaultModelId: "qwen/qwen3.5-35b-a3b",
		capabilities: {
			oauth: true,
			download: false,
			userApiKey: false,
		},

		enable() {
			store.setRow("aiProviders", "openrouter", {
				id: "openrouter",
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
				mmprojFilename: "",
				capabilitiesVersion: 0,
			});
		},

		async disable() {
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
			await deleteProviderCredentials("openrouter");
			cachedApiKey = "";
			store.delRow("aiProviders", "openrouter");
		},

		async setup() {
			await refreshApiKey();
			const apiKey = getApiKey();
			if (!apiKey) {
				store.setCell("aiProviders", "openrouter", "status", "needs_setup");
				return;
			}

			store.setCell("aiProviders", "openrouter", "status", "configuring");

			try {
				// Validate API key
				const response = await expoFetch(OPENROUTER_AUTH_KEY_URL, {
					headers: { Authorization: `Bearer ${apiKey}` },
				});

				if (!response.ok) {
					throw new Error("Invalid API key");
				}

				store.setCell("aiProviders", "openrouter", "status", "ready");
				store.setCell("aiProviders", "openrouter", "error", "");
			} catch (error) {
				console.error("[OpenRouter] Setup failed:", error);
				const errorMessage =
					error instanceof Error ? error.message : "Setup failed";
				store.setCell("aiProviders", "openrouter", "error", errorMessage);
				store.setCell("aiProviders", "openrouter", "status", "error");
			}
		},

		async startOAuth() {
			await startOAuth(store);
		},

		async handleOAuthCallback(params: Record<string, string>) {
			await handleOAuthCallback(store, params);
		},

		async models(search?: string) {
			await refreshApiKey();
			const apiKey = getApiKey();
			if (!apiKey) return [];

			try {
				const response = await expoFetch(OPENROUTER_MODELS_URL, {
					headers: { Authorization: `Bearer ${apiKey}` },
				});

				if (!response.ok) {
					throw new Error(`Failed to fetch models: ${response.status}`);
				}

				const data = (await response.json()) as {
					data: Array<{
						id: string;
						name: string;
						description?: string;
						context_length?: number;
						architecture?: {
							instruct_type?: string | null;
							input_modalities?: string[];
							output_modalities?: string[];
						};
					}>;
				};

				// Filter to chat-capable models: must accept text input and produce text output
				let models: CachedModelInfo[] = data.data
					.filter((m) => {
						const arch = m.architecture;
						if (!arch) return false;
						const hasTextInput = arch.input_modalities?.includes("text");
						const hasTextOutput = arch.output_modalities?.includes("text");
						return hasTextInput && hasTextOutput;
					})
					.map((m) => ({
						id: m.id,
						name: m.name,
						description: m.description,
						contextLength: m.context_length,
						inputModalities: m.architecture?.input_modalities,
					}));

				cachedModels = models;

				// Refresh persisted modalities for the currently-selected model (fixes reactivity)
				const currentId = getSelectedModelId();
				const currentModel = cachedModels.find((m) => m.id === currentId);
				if (currentId && currentModel) {
					store.setCell(
						"aiProviders", "openrouter", "modelCard",
						JSON.stringify({ inputModalities: currentModel.inputModalities ?? [] }),
					);
					updateCapabilitiesVersion();
				}

				if (search) {
					const query = search.toLowerCase();
					models = models.filter(
						(m) =>
							m.name.toLowerCase().includes(query) ||
							m.id.toLowerCase().includes(query),
					);
				} else if (this.defaultModelId) {
					models = [
						{
							id: this.defaultModelId,
							name: `Suggested: ${this.defaultModelId}`,
						},
						...models,
					];
				}

				return models;
			} catch (error) {
				console.error("[OpenRouter] Failed to fetch models:", error);
				return [];
			}
		},

		setModel(modelId: string) {
			store.setCell("aiProviders", "openrouter", "selectedModelId", modelId);
			const model = cachedModels.find((m) => m.id === modelId);
			if (model) {
				store.setCell(
					"aiProviders", "openrouter", "modelCard",
					JSON.stringify({ inputModalities: model.inputModalities ?? [] }),
				);
				updateCapabilitiesVersion();
			} else {
				// Model not in cache yet (e.g. default model on fresh install) —
				// fetch models in the background so capabilities are populated once available.
				void this.models();
			}
		},

		async completion(
			messages: CompletionMessage[],
			onToken: (token: string) => void,
			options?: { tools?: ToolDefinition[] },
		): Promise<CompletionResult> {
			await refreshApiKey();
			const apiKey = getApiKey();
			const modelId = getSelectedModelId();

			if (!apiKey || !modelId) {
				return { content: "", finishReason: "error" };
			}

			// Keep a local reference so stopCompletion() nulling the module
			// variable doesn't break abort detection in the catch block.
			const localAbortController = new AbortController();
			abortController = localAbortController;

			let content = "";

			try {
				// Convert multimodal content parts to AI SDK format
				// Check if the current model supports native audio
				const model = cachedModels.find((m) => m.id === modelId);
				const supportsNativeAudio = model?.inputModalities?.includes("audio") ?? false;
				// T070: STT budget coordination — ensure whisper.rn is loaded before audio processing
				if (!supportsNativeAudio) {
					const hasAudioParts = messages.some(
						(m) => Array.isArray(m.content) && m.content.some((p: CompletionMessagePart) => p.type === "audio"),
					);
					if (hasAudioParts) {
						const sttStatus = getCapabilityStatus("stt");
						if (sttStatus === "unloaded" || sttStatus === "budget_denied") {
							dispatch("stt", sttStatus === "budget_denied" ? { type: "RETRY" } : { type: "USER_REQUEST" });
							try {
								await initSTT();
								dispatch("stt", { type: "LOAD_SUCCESS" });
							} catch {
								dispatch("stt", { type: "LOAD_FAIL_BUDGET" });
								// STT not available — audio will fall through to alt-text
							}
						}
					}
				}

				const convertedMessages = await convertMessagesForAISDK(messages, { supportsNativeAudio });

				// Pass expo/fetch to createOpenRouter so its internal postToApi uses
				// the streaming-capable fetch required by React Native / Hermes.
				const openrouter = createOpenRouter({
					apiKey,
					fetch: expoFetch as unknown as typeof globalThis.fetch,
				});

				const aiTools = options?.tools?.length
					? convertToAISDKTools(options.tools)
					: undefined;

				const result = streamText({
					model: openrouter(modelId),
					messages: convertedMessages as unknown as ModelMessage[],
					tools: aiTools,
					abortSignal: localAbortController.signal,
				});

				for await (const chunk of result.textStream) {
					content += chunk;
					onToken(chunk);
				}

				const finishReason = await result.finishReason;
				const usage = await result.usage;

				// Handle tool calls
				if (finishReason === "tool-calls") {
					const toolCalls = await result.toolCalls ?? [];
					return {
						content,
						finishReason: "tool_calls",
						toolCalls: toolCalls.map((tc: { toolCallId: string; toolName: string; args: Record<string, unknown> }) => ({
							id: tc.toolCallId,
							name: tc.toolName,
							arguments: tc.args,
						})),
						usage: {
							promptTokens: usage?.promptTokens,
							completionTokens: usage?.completionTokens,
						},
					};
				}

				return {
					content,
					finishReason: finishReason === "length" ? "length" : "stop",
					usage: {
						promptTokens: usage?.promptTokens,
						completionTokens: usage?.completionTokens,
					},
				};
			} catch (error) {
				if (localAbortController.signal.aborted) {
					return { content, finishReason: "cancelled" };
				}
				console.error("[OpenRouter] Completion failed:", error);
				throw error;
			} finally {
				abortController = null;
			}
		},

		stopCompletion() {
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
		},

		isConfigured(): boolean {
			// Uses cached key for synchronous check
			const apiKey = getApiKey();
			const modelId = getSelectedModelId();
			return !!(apiKey && modelId);
		},

		getSystemMessage(_conversationMessages: CompletionMessage[]): string {
			return `You are a helpful, accurate, and creative AI assistant. Today's date is ${new Date().toLocaleString()}.`;
		},

		getContextSize(): number {
			const modelId = getSelectedModelId();
			if (modelId) {
				const model = cachedModels.find((m) => m.id === modelId);
				if (model?.contextLength) {
					return model.contextLength;
				}
			}
			return DEFAULT_CLOUD_CONTEXT_SIZE;
		},

		getMultimodalCapabilities(): MultimodalCapabilities {
			const modelId = getSelectedModelId();
			if (!modelId) return { ...NO_MULTIMODAL, audio: true };

			let modalities: string[] = [];
			const model = cachedModels.find((m) => m.id === modelId);
			if (model) {
				modalities = model.inputModalities ?? [];
			} else {
				// Cold-start fallback: read persisted modalities from TinyBase
				const raw = store.getCell("aiProviders", "openrouter", "modelCard") as string;
				if (raw) {
					try {
						const parsed = JSON.parse(raw) as { inputModalities?: string[] };
						modalities = parsed.inputModalities ?? [];
					} catch { /* ignore */ }
				}
			}

			return {
				vision: modalities.includes("image"),
				// Audio is always available — whisper.rn (bundled) provides
				// universal transcription as fallback for models without native audio
				audio: true,
				files: modalities.includes("file"),
				constraints: DEFAULT_CONSTRAINTS,
			};
		},

		getToolCapabilities() {
			return {
				supported: true,
				nativeToolCalling: true,
				promptFallback: true,
				maxActiveTools: 10,
				parallelCalls: true,
			};
		},

		async teardown() {
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
		},
	};

	return provider;
}
