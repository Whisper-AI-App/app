import {
	deleteProviderCredentials,
	getCredential,
} from "@/src/actions/secure-credentials";
import * as FileSystem from "expo-file-system";
import { fetch as expoFetch } from "expo/fetch";
import type { Store } from "tinybase";
import type {
	AIProvider,
	CompletionMessage,
	CompletionResult,
	MultimodalCapabilities,
	ProviderModel,
	ToolCapabilities,
} from "../types";
import { DEFAULT_CONSTRAINTS, NO_MULTIMODAL } from "../types";
import {
	requestDeviceCode,
	pollForAuthorization,
	cancelPolling,
	OPENAI_CLIENT_ID,
	OPENAI_TOKEN_URL,
} from "./oauth";
import { getValidAccessToken } from "../token-refresh";

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
	{ id: "gpt-5.1-codex-mini", name: "GPT-5.1 Codex Mini", contextLength: 192000 },
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
			(store.getCell(
				"aiProviders",
				"openai",
				"selectedModelId",
			) as string) || ""
		);
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
			options?: { tools?: import("../../tools/types").ToolDefinition[] },
		): Promise<CompletionResult> {
			await refreshAccessToken();
			const token = getAccessToken();
			const modelId = getSelectedModelId();
			const accountId = await getAccountId();

			if (!token || !modelId) {
				return { content: "", finishReason: "error" };
			}

			const localAbortController = new AbortController();
			abortController = localAbortController;

			let content = "";

			try {
				// Build input array in the Responses API format
				const input: Array<Record<string, unknown>> = [];
				for (const msg of messages) {
					if (typeof msg.content === "string") {
						input.push({
							role: msg.role === "system" ? "developer" : msg.role,
							content: msg.content,
						});
					} else {
						// Multimodal parts — convert to Responses API format
						const parts: Array<Record<string, unknown>> = [];
						for (const part of msg.content) {
							if (part.type === "text") {
								parts.push({ type: "input_text", text: part.text });
							} else if (part.type === "image") {
								try {
									const file = new FileSystem.File(part.uri);
									if (!file.exists) throw new Error(`File not found: ${part.uri}`);
									const base64 = await file.base64();
									const mimeType = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(part.mimeType)
										? part.mimeType
										: "image/jpeg";
									parts.push({
										type: "input_image",
										image_url: `data:${mimeType};base64,${base64}`,
									});
								} catch {
									parts.push({ type: "input_text", text: `[${part.alt}]` });
								}
							} else if (part.type === "audio") {
								// Use alt text (transcription) for audio
								parts.push({ type: "input_text", text: `[${part.alt}]` });
							} else if (part.type === "file") {
								parts.push({ type: "input_text", text: `[${part.alt}]` });
							}
						}
						input.push({
							role: msg.role === "system" ? "developer" : msg.role,
							content: parts,
						});
					}
				}

				const response = await expoFetch(
					`${CODEX_API_BASE}/responses`,
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${token}`,
							"ChatGPT-Account-Id": accountId,
							originator: "codex_cli_rs",
						},
						body: JSON.stringify({
							model: modelId,
							instructions: input.find((m) => m.role === "developer")?.content ?? "You are a helpful assistant.",
							input: input.filter((m) => m.role !== "developer"),
							stream: true,
							store: false,
							...(options?.tools?.length
								? {
										tools: options.tools.map((t) => ({
											type: "function",
											name: t.name,
											description: t.description,
											parameters: {
												type: "object",
												properties: Object.fromEntries(
													t.parameters.map((p) => [
														p.name,
														{
															type: p.type,
															description: p.description,
															...(p.enum ? { enum: p.enum } : {}),
														},
													]),
												),
												required: t.parameters
													.filter((p) => p.required)
													.map((p) => p.name),
											},
										})),
									}
								: {}),
						}),
						signal: localAbortController.signal,
					},
				);

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(
						`Codex API error ${response.status}: ${errorText}`,
					);
				}

				// Parse SSE stream
				const reader = response.body?.getReader();
				if (!reader) {
					throw new Error("No response body");
				}

				const decoder = new TextDecoder();
				let buffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split("\n");
					buffer = lines.pop() ?? "";

					for (const line of lines) {
						if (!line.startsWith("data: ")) continue;
						const data = line.slice(6).trim();
						if (data === "[DONE]") continue;

						try {
							const event = JSON.parse(data) as {
								type?: string;
								delta?: string;
								status?: string;
							};
							if (
								event.type === "response.output_text.delta" &&
								event.delta
							) {
								content += event.delta;
								onToken(event.delta);
							}
						} catch {
							// Skip unparseable events
						}
					}
				}

				return {
					content,
					finishReason: "stop",
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
