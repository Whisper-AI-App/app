import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { fetch as expoFetch } from "expo/fetch";
import type { Store } from "tinybase";
import {
	deleteProviderCredentials,
	getCredential,
} from "@/src/actions/secure-credentials";
import { createLogger } from "@/src/logger";
import { convertMessagesForAISDK } from "../message-converter";
import { convertToAISDKTools } from "../tool-converter";
import { getValidAccessToken } from "../token-refresh";
import type {
	AIProvider,
	CompletionMessage,
	CompletionResult,
	MultimodalCapabilities,
	ProviderModel,
	ToolCapabilities,
	ToolDefinition,
} from "../types";
import { DEFAULT_CONSTRAINTS, NO_MULTIMODAL } from "../types";
import {
	cancelPolling,
	OPENAI_CLIENT_ID,
	OPENAI_TOKEN_URL,
	pollForAuthorization,
	requestDeviceCode,
} from "./oauth";

const logger = createLogger("OpenAI");

const CODEX_API_BASE = "https://chatgpt.com/backend-api/codex";
const DEFAULT_CLOUD_CONTEXT_SIZE = 128000;

/**
 * Hardcoded model list — the ChatGPT backend doesn't expose a models endpoint.
 * These are the models available via Codex OAuth (ChatGPT Plus/Pro subscription).
 */
const CODEX_MODELS: ProviderModel[] = [
	{ id: "gpt-5.4", name: "GPT-5.4", contextLength: 128000 },
	{ id: "gpt-5.4-mini", name: "GPT-5.4 Mini", contextLength: 128000 },
	{ id: "gpt-5.3-codex", name: "GPT-5.3 Codex", contextLength: 192000 },
	{ id: "gpt-5.2-codex", name: "GPT-5.2 Codex", contextLength: 192000 },
	{ id: "gpt-5.2", name: "GPT-5.2", contextLength: 128000 },
	{ id: "gpt-5.1-codex", name: "GPT-5.1 Codex", contextLength: 192000 },
	{ id: "gpt-5.1-codex-max", name: "GPT-5.1 Codex Max", contextLength: 192000 },
	{
		id: "gpt-5.1-codex-mini",
		name: "GPT-5.1 Codex Mini",
		contextLength: 192000,
	},
];

// Module-scoped runtime state
let abortController: AbortController | null = null;

const REFRESH_CONFIG = {
	providerId: "openai",
	tokenUrl: OPENAI_TOKEN_URL,
	clientId: OPENAI_CLIENT_ID,
};

export function createOpenAIProvider(store: Store): AIProvider {
	let cachedAccessToken = "";

	async function refreshAccessToken(): Promise<string> {
		const token = await getValidAccessToken(REFRESH_CONFIG);
		cachedAccessToken = token ?? "";
		return cachedAccessToken;
	}

	function getAccessToken(): string {
		return cachedAccessToken;
	}

	async function getAccountId(): Promise<string> {
		return (await getCredential("openai", "accountId")) ?? "";
	}

	function getSelectedModelId(): string {
		return (
			(store.getCell("aiProviders", "openai", "selectedModelId") as string) ||
			""
		);
	}

	/**
	 * Custom fetch wrapper for the Codex API.
	 * Handles token refresh, injects required headers, and patches the
	 * request body to include `store: false` as required by the Codex backend.
	 *
	 */
	async function codexFetch(
		url: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> {
		// Refresh token before each request
		await refreshAccessToken();
		const token = getAccessToken();
		const accountId = await getAccountId();

		const headers = new Headers(init?.headers);
		headers.set("Authorization", `Bearer ${token}`);
		headers.set("ChatGPT-Account-Id", accountId);
		headers.set("originator", "codex_cli_rs");

		// Patch the request body for Codex backend requirements:
		// 1. Add store: false
		// 2. Extract developer/system message from input[] into top-level instructions
		//    (Codex requires instructions as a separate field, not inline in input)
		let body = init?.body;
		if (typeof body === "string") {
			try {
				const parsed = JSON.parse(body) as Record<string, unknown>;
				parsed.store = false;

				// Move developer message from input to instructions
				const input = parsed.input as
					| Array<Record<string, unknown>>
					| undefined;
				if (input && !parsed.instructions) {
					const devIdx = input.findIndex((m) => m.role === "developer");
					if (devIdx !== -1) {
						parsed.instructions =
							input[devIdx].content ?? "You are a helpful assistant.";
						input.splice(devIdx, 1);
					}
				}

				body = JSON.stringify(parsed);
			} catch {
				// Not JSON — leave body as-is
			}
		}

		// Convert Headers to plain object for expoFetch compatibility
		const headersObj: Record<string, string> = {};
		headers.forEach((value, key) => {
			headersObj[key] = value;
		});

		return expoFetch(url, {
			...init,
			headers: headersObj,
			body,
		} as RequestInit);
	}

	const provider: AIProvider = {
		id: "openai",
		name: "ChatGPT",
		description: "Access GPT models via Codex with your ChatGPT subscription.",
		avatar: require("../../../assets/images/ai-providers/openai.png"),
		type: "cloud",
		defaultModelId: "gpt-5.4",
		capabilities: {
			oauth: true,
			download: false,
			userApiKey: false,
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
				capabilitiesVersion: 0,
			});
		},

		async disable() {
			cancelPolling();
			if (abortController) {
				abortController.abort();
				abortController = null;
			}
			await deleteProviderCredentials("openai");
			cachedAccessToken = "";
			store.delRow("aiProviders", "openai");
		},

		async setup() {
			await refreshAccessToken();
			const token = getAccessToken();
			if (!token) {
				store.setCell("aiProviders", "openai", "status", "needs_setup");
				return;
			}

			store.setCell("aiProviders", "openai", "status", "ready");
			store.setCell("aiProviders", "openai", "error", "");
		},

		async startOAuth() {
			const deviceCode = await requestDeviceCode(store);
			if (!deviceCode) return;

			// Store device code state in TinyBase so the UI can display it
			store.setCell(
				"aiProviders",
				"openai",
				"modelCard",
				JSON.stringify({
					deviceCode: deviceCode.userCode,
					deviceAuthId: deviceCode.deviceAuthId,
				}),
			);

			// Start polling (runs until user authorizes, times out, or is cancelled)
			await pollForAuthorization(
				store,
				deviceCode.deviceAuthId,
				deviceCode.userCode,
			);
		},

		async models(search?: string) {
			let models = [...CODEX_MODELS];

			if (search) {
				const query = search.toLowerCase();
				models = models.filter(
					(m) =>
						m.name.toLowerCase().includes(query) ||
						m.id.toLowerCase().includes(query),
				);
			} else if (this.defaultModelId) {
				// Put suggested model first
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
			store.setCell("aiProviders", "openai", "selectedModelId", modelId);
		},

		async completion(
			messages: CompletionMessage[],
			onToken: (token: string) => void,
			options?: { tools?: ToolDefinition[] },
		): Promise<CompletionResult> {
			await refreshAccessToken();
			const token = getAccessToken();
			const modelId = getSelectedModelId();

			if (!token || !modelId) {
				return { content: "", finishReason: "error" };
			}

			const localAbortController = new AbortController();
			abortController = localAbortController;

			let content = "";

			try {
				// Convert multimodal content parts to AI SDK format
				const convertedMessages = await convertMessagesForAISDK(messages);

				// Create OpenAI provider pointing at Codex API with custom fetch
				const openai = createOpenAI({
					baseURL: CODEX_API_BASE,
					apiKey: "",
					fetch: codexFetch as unknown as typeof globalThis.fetch,
				});

				const aiTools = options?.tools?.length
					? convertToAISDKTools(options.tools)
					: undefined;

				const result = streamText({
					model: openai.responses(modelId),
					messages: convertedMessages as unknown as import("ai").ModelMessage[],
					tools: aiTools,
					abortSignal: localAbortController.signal,
				});

				for await (const chunk of result.textStream) {
					content += chunk;
					onToken(chunk);
				}

				const finishReason = await result.finishReason;
				const usage = await result.usage;

				if (finishReason === "tool-calls") {
					const toolCalls = await result.toolCalls ?? [];
					return {
						content,
						finishReason: "tool_calls",
						toolCalls: toolCalls
							.filter((tc) => "args" in tc)
							.map((tc) => ({
								id: tc.toolCallId,
								name: tc.toolName,
								arguments: (tc as { args: Record<string, unknown> }).args,
							})),
						usage: {
							promptTokens: usage?.inputTokens,
							completionTokens: usage?.outputTokens,
						},
					};
				}

				return {
					content,
					finishReason: finishReason === "length" ? "length" : "stop",
					usage: {
						promptTokens: usage?.inputTokens,
						completionTokens: usage?.outputTokens,
					},
				};
			} catch (error) {
				if (localAbortController.signal.aborted) {
					return { content, finishReason: "cancelled" };
				}
				logger.error("Completion failed", {
					error: error instanceof Error ? error.message : String(error),
				});
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
			const token = getAccessToken();
			const modelId = getSelectedModelId();
			return !!(token && modelId);
		},

		getSystemMessage(_conversationMessages: CompletionMessage[]): string {
			return `You are a helpful, accurate, and creative AI assistant. Today's date is ${new Date().toLocaleString()}.`;
		},

		getContextSize(): number {
			const modelId = getSelectedModelId();
			const model = CODEX_MODELS.find((m) => m.id === modelId);
			return model?.contextLength ?? DEFAULT_CLOUD_CONTEXT_SIZE;
		},

		getMultimodalCapabilities(): MultimodalCapabilities {
			const modelId = getSelectedModelId();
			if (!modelId) return { ...NO_MULTIMODAL, audio: true };

			const supportsVision = modelId.includes("gpt-5");

			return {
				vision: supportsVision,
				audio: true,
				files: false,
				constraints: DEFAULT_CONSTRAINTS,
			};
		},

		getToolCapabilities(): ToolCapabilities {
			return {
				supported: true,
				nativeToolCalling: true,
				promptFallback: true,
				maxActiveTools: 10,
				parallelCalls: true,
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
