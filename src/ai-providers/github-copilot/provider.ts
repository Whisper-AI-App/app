import {
	deleteProviderCredentials,
	getCredential,
} from "@/src/actions/secure-credentials";
import { createOpenAI } from "@ai-sdk/openai";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { streamText } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import type { Store } from "tinybase";
import type {
	AIProvider,
	CompletionMessage,
	CompletionResult,
	MultimodalCapabilities,
	ProviderModel,
} from "../types";
import { DEFAULT_CONSTRAINTS, NO_MULTIMODAL } from "../types";
import { convertMessagesForAISDK } from "../message-converter";
import {
	requestDeviceCode,
	pollForAuthorization,
	cancelPolling,
	getCopilotApiToken,
	clearCopilotTokenCache,
	COPILOT_BASE_URL,
	COPILOT_HEADERS,
} from "./oauth";

const DEFAULT_CLOUD_CONTEXT_SIZE = 128000;

/**
 * Hardcoded model list — models available depend on Copilot subscription tier.
 */
const COPILOT_MODELS: ProviderModel[] = [
	{ id: "gpt-5.3-codex", name: "GPT-5.3 Codex", contextLength: 192000 },
	{ id: "gpt-4.1", name: "GPT-4.1", contextLength: 128000 },
	{ id: "claude-sonnet-4.6", name: "Claude Sonnet 4.6", contextLength: 200000 },
	{ id: "gpt-5.4", name: "GPT-5.4", contextLength: 128000 },
	{ id: "gpt-5.4-mini", name: "GPT-5.4 Mini", contextLength: 128000 },
	{ id: "gpt-4.1-mini", name: "GPT-4.1 Mini", contextLength: 128000 },
	{ id: "o3-mini", name: "o3-mini", contextLength: 200000 },
];

// Module-scoped runtime state
let abortController: AbortController | null = null;
let cachedModels: ProviderModel[] = [];

export function createGitHubCopilotProvider(store: Store): AIProvider {
	function getSelectedModelId(): string {
		return (
			(store.getCell(
				"aiProviders",
				"github-copilot",
				"selectedModelId",
			) as string) || ""
		);
	}

	const provider: AIProvider = {
		id: "github-copilot",
		name: "GitHub Copilot",
		description:
			"Access AI models with your GitHub Copilot subscription.",
		avatar: require("../../../assets/images/ai-providers/github-copilot.png"),
		type: "cloud",
		defaultModelId: "gpt-5.3-codex",
		capabilities: {
			oauth: true,
			download: false,
			userApiKey: false,
		},

		enable() {
			store.setRow("aiProviders", "github-copilot", {
				id: "github-copilot",
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
				capabilitiesVersion: 0,
			});
		},

		async disable() {
			cancelPolling();
			clearCopilotTokenCache();
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
			await deleteProviderCredentials("github-copilot");
			store.delRow("aiProviders", "github-copilot");
		},

		async setup() {
			const oauthToken = await getCredential(
				"github-copilot",
				"oauthToken",
			);
			if (!oauthToken) {
				store.setCell(
					"aiProviders",
					"github-copilot",
					"status",
					"needs_setup",
				);
				return;
			}

			// Verify the OAuth token works by fetching a Copilot API token
			const copilotToken = await getCopilotApiToken();
			if (!copilotToken) {
				store.setCell(
					"aiProviders",
					"github-copilot",
					"error",
					"Failed to verify Copilot access. Please reconnect.",
				);
				store.setCell(
					"aiProviders",
					"github-copilot",
					"status",
					"error",
				);
				return;
			}

			store.setCell(
				"aiProviders",
				"github-copilot",
				"status",
				"ready",
			);
			store.setCell("aiProviders", "github-copilot", "error", "");
		},

		async startOAuth() {
			const deviceCode = await requestDeviceCode(store);
			if (!deviceCode) return;

			// Store device code state in TinyBase so the UI can display it
			store.setCell(
				"aiProviders",
				"github-copilot",
				"modelCard",
				JSON.stringify({
					deviceCode: deviceCode.userCode,
					deviceAuthId: deviceCode.deviceCode,
				}),
			);

			// Start polling
			await pollForAuthorization(
				store,
				deviceCode.deviceCode,
				deviceCode.interval,
			);
		},

		async models(search?: string) {
			const copilotToken = await getCopilotApiToken();
			let models: ProviderModel[];

			// Try fetching models from the API, fall back to hardcoded list
			if (copilotToken) {
				try {
					const response = await expoFetch(
						`${COPILOT_BASE_URL}/models`,
						{
							headers: {
								Authorization: `Bearer ${copilotToken}`,
								...COPILOT_HEADERS,
							},
						},
					);

					if (response.ok) {
						const data = (await response.json()) as {
							data: Array<{
								id: string;
								name?: string;
								version?: string;
								context_length?: number;
							}>;
						};

						models = data.data
							.map((m) => ({
								id: m.id,
								name: m.name || m.id,
								contextLength: m.context_length,
							}))
							.sort((a, b) => a.name.localeCompare(b.name));

						if (models.length > 0) {
							cachedModels = models;
						} else {
							models = [...COPILOT_MODELS];
						}
					} else {
						models = cachedModels.length > 0 ? [...cachedModels] : [...COPILOT_MODELS];
					}
				} catch {
					models = cachedModels.length > 0 ? [...cachedModels] : [...COPILOT_MODELS];
				}
			} else {
				models = [...COPILOT_MODELS];
			}

			if (search) {
				const query = search.toLowerCase();
				models = models.filter(
					(m) =>
						m.name.toLowerCase().includes(query) ||
						m.id.toLowerCase().includes(query),
				);
			} else if (this.defaultModelId) {
				const defaultIdx = models.findIndex(
					(m) => m.id === this.defaultModelId,
				);
				if (defaultIdx > 0) {
					const [suggested] = models.splice(defaultIdx, 1);
					models.unshift({
						...suggested,
						name: `Suggested: ${suggested.name}`,
					});
				}
			}

			return models;
		},

		setModel(modelId: string) {
			store.setCell(
				"aiProviders",
				"github-copilot",
				"selectedModelId",
				modelId,
			);
		},

		async completion(
			messages: CompletionMessage[],
			onToken: (token: string) => void,
		): Promise<CompletionResult> {
			const copilotToken = await getCopilotApiToken();
			const modelId = getSelectedModelId();

			if (!copilotToken || !modelId) {
				return { content: "", finishReason: "error" };
			}

			const localAbortController = new AbortController();
			abortController = localAbortController;

			let content = "";

			try {
				const convertedMessages =
					await convertMessagesForAISDK(messages);

				const copilot = createOpenAI({
					apiKey: copilotToken,
					baseURL: `${COPILOT_BASE_URL}/`,
					headers: {
						...COPILOT_HEADERS,
						"Openai-Intent": "conversation-edits",
						"X-Initiator": "agent",
					},
					fetch: expoFetch as unknown as typeof globalThis.fetch,
				});

				// GPT-5+ uses Responses API, others use Chat Completions
				const model = modelId.includes("gpt-5")
					? copilot.responses(modelId)
					: copilot.chat(modelId);

				const result = streamText({
					model,
					messages: convertedMessages as ModelMessage[],
					abortSignal: localAbortController.signal,
				});

				for await (const chunk of result.textStream) {
					content += chunk;
					onToken(chunk);
				}

				const finishReason = await result.finishReason;
				const usage = await result.usage;

				return {
					content,
					finishReason:
						finishReason === "length" ? "length" : "stop",
					usage: {
						promptTokens: usage?.inputTokens,
						completionTokens: usage?.outputTokens,
					},
				};
			} catch (error) {
				if (localAbortController.signal.aborted) {
					return { content, finishReason: "cancelled" };
				}
				console.error("[Copilot] Completion failed:", error);
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
			const modelId = getSelectedModelId();
			return !!modelId;
		},

		getSystemMessage(_conversationMessages: CompletionMessage[]): string {
			return `You are a helpful, accurate, and creative AI assistant. Today's date is ${new Date().toLocaleString()}.`;
		},

		getContextSize(): number {
			const modelId = getSelectedModelId();
			const model = COPILOT_MODELS.find((m) => m.id === modelId);
			return model?.contextLength ?? DEFAULT_CLOUD_CONTEXT_SIZE;
		},

		getMultimodalCapabilities(): MultimodalCapabilities {
			const modelId = getSelectedModelId();
			if (!modelId) return { ...NO_MULTIMODAL, audio: true };

			const supportsVision =
				modelId.includes("gpt-5") ||
				modelId.includes("gpt-4.1") ||
				modelId.includes("claude");

			return {
				vision: supportsVision,
				audio: true,
				files: false,
				constraints: DEFAULT_CONSTRAINTS,
			};
		},

		async teardown() {
			cancelPolling();
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
		},
	};

	return provider;
}
