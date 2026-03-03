import { createAnthropic } from "@ai-sdk/anthropic";
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

export type Protocol = "openai" | "anthropic";

const DEFAULT_CLOUD_CONTEXT_SIZE = 128000;

// Module-scoped runtime state
let abortController: AbortController | null = null;
let cachedModels: ProviderModel[] = [];

export function createCustomProvider(store: Store): AIProvider {
	function getApiKey(): string {
		return (
			(store.getCell("aiProviders", "custom-provider", "apiKey") as string) ||
			""
		);
	}

	function getEndpointUrl(): string {
		return (
			(store.getCell(
				"aiProviders",
				"custom-provider",
				"endpointUrl",
			) as string) || ""
		);
	}

	function getProtocol(): Protocol {
		return (
			(store.getCell(
				"aiProviders",
				"custom-provider",
				"protocol",
			) as Protocol) || "openai"
		);
	}

	function getModelsUrl(): string {
		const endpoint = getEndpointUrl().replace(/\/+$/, "");
		return `${endpoint}/models`;
	}

	function getSelectedModelId(): string {
		return (
			(store.getCell(
				"aiProviders",
				"custom-provider",
				"selectedModelId",
			) as string) || ""
		);
	}

	const provider: AIProvider = {
		id: "custom-provider",
		name: "Custom",
		description:
			"Connect to any OpenAI-compatible or Anthropic-compatible API provider.",
		avatar: require("../../../assets/images/ai-providers/custom-provider.png"),
		type: "cloud",
		defaultModelId: "",
		capabilities: {
			oauth: false,
			download: false,
			userApiKey: true,
		},

		enable() {
			store.setRow("aiProviders", "custom-provider", {
				id: "custom-provider",
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
				endpointUrl: "",
				protocol: "openai",
			});
		},

		async disable() {
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
			store.delRow("aiProviders", "custom-provider");
		},

		async setup() {
			const apiKey = getApiKey();
			const endpointUrl = getEndpointUrl();
			if (!apiKey || !endpointUrl) {
				store.setCell(
					"aiProviders",
					"custom-provider",
					"status",
					"needs_setup",
				);
				return;
			}

			// Mark as ready immediately — model listing is optional for
			// OpenAI-compatible endpoints, so we don't gate on /models.
			store.setCell("aiProviders", "custom-provider", "status", "ready");
			store.setCell("aiProviders", "custom-provider", "error", "");
		},

		async models(search?: string) {
			const apiKey = getApiKey();
			const endpointUrl = getEndpointUrl();
			if (!apiKey || !endpointUrl) return [];

			try {
				const response = await expoFetch(getModelsUrl(), {
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

				let models: ProviderModel[] = data.data
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
				}

				return models;
			} catch (error) {
				console.error("[Custom Provider] Failed to fetch models:", error);
				return [];
			}
		},

		setModel(modelId: string) {
			store.setCell(
				"aiProviders",
				"custom-provider",
				"selectedModelId",
				modelId,
			);
		},

		async completion(
			messages: CompletionMessage[],
			onToken: (token: string) => void,
		): Promise<CompletionResult> {
			const apiKey = getApiKey();
			const modelId = getSelectedModelId();
			const endpointUrl = getEndpointUrl();
			const protocol = getProtocol();

			if (!apiKey || !modelId || !endpointUrl) {
				return { content: "", finishReason: "error" };
			}

			const localAbortController = new AbortController();
			abortController = localAbortController;

			let content = "";

			try {
				const baseURL = `${endpointUrl.replace(/\/+$/, "")}/`;

				if (protocol === "anthropic") {
					// Use Anthropic SDK
					const anthropic = createAnthropic({
						apiKey,
						baseURL,
						fetch: expoFetch as unknown as typeof globalThis.fetch,
					});

					const result = streamText({
						model: anthropic(modelId),
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
				} else {
					// Use OpenAI SDK (default)
					const openai = createOpenAI({
						apiKey,
						baseURL,
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
				}
			} catch (error) {
				if (localAbortController.signal.aborted) {
					return { content, finishReason: "cancelled" };
				}
				console.error("[Custom Provider] Completion failed:", error);
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
			const endpointUrl = getEndpointUrl();
			return !!(apiKey && modelId && endpointUrl);
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
