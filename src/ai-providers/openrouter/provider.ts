import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import type { Store } from "tinybase";
import type {
	AIProvider,
	CompletionMessage,
	CompletionResult,
	ProviderModel,
} from "../types";
import { handleOAuthCallback, startOAuth } from "./oauth";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const OPENROUTER_AUTH_KEY_URL = "https://openrouter.ai/api/v1/auth/key";
const DEFAULT_CLOUD_CONTEXT_SIZE = 128000;

// Module-scoped runtime state
let abortController: AbortController | null = null;

export function createOpenRouterProvider(store: Store): AIProvider {
	function getApiKey(): string {
		return (
			(store.getCell("aiProviders", "openrouter", "apiKey") as string) || ""
		);
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
		defaultModelId: "openai/gpt-oss-20b:nitro",
		capabilities: {
			oauth: true,
			download: false,
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
				apiKey: "",
				oAuthCodeVerifier: "",
			});
		},

		async disable() {
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
			store.delRow("aiProviders", "openrouter");
		},

		async setup() {
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

				// Filter to chat-capable models: must accept text input,
				// produce text output, and support an instruct format
				let models: ProviderModel[] = data.data
					.filter((m) => {
						const arch = m.architecture;
						if (!arch) return false;
						const hasTextInput = arch.input_modalities?.includes("text");
						const hasTextOutput = arch.output_modalities?.includes("text");
						const hasInstruct = !!arch.instruct_type;
						return hasTextInput && hasTextOutput && hasInstruct;
					})
					.map((m) => ({
						id: m.id,
						name: m.name,
						description: m.description,
						contextLength: m.context_length,
					}));

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
		},

		async completion(
			messages: CompletionMessage[],
			onToken: (token: string) => void,
		): Promise<CompletionResult> {
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
				// Pass expo/fetch to createOpenRouter so its internal postToApi uses
				// the streaming-capable fetch required by React Native / Hermes.
				const openrouter = createOpenRouter({
					apiKey,
					fetch: expoFetch as unknown as typeof globalThis.fetch,
				});

				const result = streamText({
					model: openrouter(modelId),
					messages,
					abortSignal: localAbortController.signal,
				});

				for await (const chunk of result.textStream) {
					content += chunk;
					onToken(chunk);
				}

				const finalResult = await result;

				return {
					content,
					finishReason:
						finalResult.finishReason === "length" ? "length" : "stop",
					usage: {
						promptTokens: finalResult.usage?.promptTokens,
						completionTokens: finalResult.usage?.completionTokens,
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
			const apiKey = getApiKey();
			const modelId = getSelectedModelId();
			return !!(apiKey && modelId);
		},

		getSystemMessage(_conversationMessages: CompletionMessage[]): string {
			return `You are a helpful, accurate, and creative AI assistant. Today's date is ${new Date().toLocaleString()}.`;
		},

		getContextSize(): number {
			return DEFAULT_CLOUD_CONTEXT_SIZE;
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
