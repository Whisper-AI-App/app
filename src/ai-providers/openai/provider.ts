import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import type { Store } from "tinybase";
import type {
	AIProvider,
	CompletionMessage,
	CompletionResult,
	ProviderModel,
} from "../types";

const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";
const DEFAULT_CLOUD_CONTEXT_SIZE = 128000;

// Module-scoped runtime state
let abortController: AbortController | null = null;
let cachedModels: ProviderModel[] = [];

export function createOpenAIProvider(store: Store): AIProvider {
	function getApiKey(): string {
		return (store.getCell("aiProviders", "openai", "apiKey") as string) || "";
	}

	function getSelectedModelId(): string {
		return (
			(store.getCell("aiProviders", "openai", "selectedModelId") as string) ||
			""
		);
	}

	const provider: AIProvider = {
		id: "openai",
		name: "OpenAI",
		description: "Access GPT models directly from OpenAI.",
		avatar: require("../../../assets/images/ai-providers/openai.png"),
		type: "cloud",
		defaultModelId: "gpt-4o-mini",
		capabilities: {
			oauth: false,
			download: false,
			userApiKey: true,
		},

		enable() {
			store.setRow("aiProviders", "openai", {
				id: "openai",
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
			store.delRow("aiProviders", "openai");
		},

		async setup() {
			const apiKey = getApiKey();
			if (!apiKey) {
				store.setCell("aiProviders", "openai", "status", "needs_setup");
				return;
			}

			store.setCell("aiProviders", "openai", "status", "configuring");

			try {
				const response = await expoFetch(OPENAI_MODELS_URL, {
					headers: { Authorization: `Bearer ${apiKey}` },
				});

				if (!response.ok) {
					throw new Error("Invalid API key");
				}

				store.setCell("aiProviders", "openai", "status", "ready");
				store.setCell("aiProviders", "openai", "error", "");
			} catch (error) {
				console.error("[OpenAI] Setup failed:", error);
				const errorMessage =
					error instanceof Error ? error.message : "Setup failed";
				store.setCell("aiProviders", "openai", "error", errorMessage);
				store.setCell("aiProviders", "openai", "status", "error");
			}
		},

		async models(search?: string) {
			const apiKey = getApiKey();
			if (!apiKey) return [];

			try {
				const response = await expoFetch(OPENAI_MODELS_URL, {
					headers: { Authorization: `Bearer ${apiKey}` },
				});

				if (!response.ok) {
					throw new Error(`Failed to fetch models: ${response.status}`);
				}

				const data = (await response.json()) as {
					data: Array<{
						id: string;
						owned_by: string;
					}>;
				};

				// Allowlist of current model families known to work with chat completions
				const ALLOWED_PREFIXES = [
					"gpt-4o",
					"gpt-4.1",
					"gpt-4.5",
					"chatgpt-4o",
					"o1",
					"o3",
					"o4",
				];

				let models: ProviderModel[] = data.data
					.filter((m) => {
						const id = m.id.toLowerCase();
						return ALLOWED_PREFIXES.some((prefix) => id.startsWith(prefix));
					})
					.map((m) => ({
						id: m.id,
						name: m.id,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));

				cachedModels = models;

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
				console.error("[OpenAI] Failed to fetch models:", error);
				return [];
			}
		},

		setModel(modelId: string) {
			store.setCell("aiProviders", "openai", "selectedModelId", modelId);
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

			const localAbortController = new AbortController();
			abortController = localAbortController;

			let content = "";

			try {
				const openai = createOpenAI({
					apiKey,
					fetch: expoFetch as unknown as typeof globalThis.fetch,
				});

				const result = streamText({
					model: openai(modelId),
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
				console.error("[OpenAI] Completion failed:", error);
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
			const modelId = getSelectedModelId();
			if (modelId) {
				const model = cachedModels.find((m) => m.id === modelId);
				if (model?.contextLength) {
					return model.contextLength;
				}
			}
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
