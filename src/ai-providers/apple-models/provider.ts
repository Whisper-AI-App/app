import type { ModelMessage } from "ai";
import { streamText } from "ai";
import type { Store } from "tinybase";
import { convertMessagesForAISDK } from "../message-converter";
import { convertToAppleTools } from "../tool-converter-apple";
import type { ToolDefinition } from "../../tools/types";
import type {
	AIProvider,
	CompletionMessage,
	CompletionResult,
	MultimodalCapabilities,
	ProviderModel,
	ToolCapabilities,
} from "../types";
import { NO_MULTIMODAL } from "../types";

// Module-scoped runtime state
let abortController: AbortController | null = null;

// Pattern to detect Apple's content safety / guardrail errors
const SAFETY_ERROR_PATTERN =
	/unsafe|safety|content.*(filter|blocked|policy|violat)|guardrail/i;

export const CONTENT_SAFETY_MESSAGE =
	"Apple Intelligence declined to generate this response due to its content safety guidelines. Try rephrasing your message.";

export function createAppleModelsProvider(store: Store): AIProvider {
	const provider: AIProvider = {
		id: "apple-models",
		name: "Apple Intelligence",
		description: "On-device Apple AI. No internet or downloads needed.",
		avatar: require("../../../assets/images/ai-providers/apple-intelligence.png"),
		type: "local",
		defaultModelId: "system-default",
		capabilities: {
			oauth: false,
			download: false,
			userApiKey: false,
		},

		enable() {
			store.setRow("aiProviders", "apple-models", {
				id: "apple-models",
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
			await provider.teardown();
			store.delRow("aiProviders", "apple-models");
		},

		async setup() {
			store.setCell("aiProviders", "apple-models", "status", "configuring");

			try {
				store.setCell(
					"aiProviders",
					"apple-models",
					"selectedModelId",
					"system-default",
				);
				store.setCell("aiProviders", "apple-models", "error", "");
				store.setCell("aiProviders", "apple-models", "status", "ready");
			} catch (error) {
				console.error("[AppleModels] Setup failed:", error);
				const errorMessage =
					error instanceof Error ? error.message : "Setup failed";
				store.setCell("aiProviders", "apple-models", "error", errorMessage);
				store.setCell("aiProviders", "apple-models", "status", "error");
			}
		},

		async models() {
			return [
				{
					id: "system-default",
					name: "Apple Intelligence",
					description: "Apple's on-device foundation model",
					contextLength: 4096,
				},
			] as ProviderModel[];
		},

		setModel(modelId: string) {
			store.setCell("aiProviders", "apple-models", "selectedModelId", modelId);
		},

		async completion(
			messages: CompletionMessage[],
			onToken: (token: string) => void,
			options?: { tools?: ToolDefinition[] },
		): Promise<CompletionResult> {
			const localAbortController = new AbortController();
			abortController = localAbortController;

			let content = "";

			try {
				const { apple, createAppleProvider } = require("@react-native-ai/apple");

				// Pre-flight check: isAvailable() can flip to false if Apple
				// Intelligence is disabled or model assets are evicted.
				if (!apple.isAvailable()) {
					const errorText =
						"Apple Intelligence model is not available. Please check Settings > Apple Intelligence & Siri.";
					onToken(errorText);
					return { content: errorText, finishReason: "error" };
				}

				const convertedMessages = await convertMessagesForAISDK(messages);
				const systemMessage = provider.getSystemMessage(messages);

				// Apple Intelligence: tools must be registered via createAppleProvider()
				// because the native layer executes them during generation.
				const model = options?.tools?.length
					? createAppleProvider({ availableTools: convertToAppleTools(options.tools) })()
					: apple();

				const result = streamText({
					model,
					system: systemMessage,
					messages: convertedMessages as unknown as ModelMessage[],
					abortSignal: localAbortController.signal,
				});

				for await (const chunk of result.textStream) {
					content += chunk;
					onToken(chunk);
				}

				// Apple executes tools internally during generation — the final
				// result already incorporates tool outputs. No tool_calls finish reason.
				const finishReason = await result.finishReason;

				if (finishReason === "error" || (!content && finishReason !== "stop")) {
					if (SAFETY_ERROR_PATTERN.test(content)) {
						onToken(CONTENT_SAFETY_MESSAGE);
						return {
							content: content + CONTENT_SAFETY_MESSAGE,
							finishReason: "stop",
						};
					}

					const errorText =
						"Apple Intelligence could not generate a response. The on-device model may still be downloading, please check Settings > Apple Intelligence & Siri and try again.";
					onToken(errorText);
					return { content: content + errorText, finishReason: "error" };
				}

				return {
					content,
					finishReason: finishReason === "length" ? "length" : "stop",
				};
			} catch (error) {
				if (localAbortController.signal.aborted) {
					return { content, finishReason: "cancelled" };
				}
				console.warn("[AppleModels] Completion failed:", error);

				const errorMsg =
					error instanceof Error ? error.message : String(error);
				if (SAFETY_ERROR_PATTERN.test(errorMsg)) {
					onToken(CONTENT_SAFETY_MESSAGE);
					return {
						content: content + CONTENT_SAFETY_MESSAGE,
						finishReason: "stop",
					};
				}

				// Apple FoundationModels throws GenerationError.assetsUnavailable
				// when model assets aren't downloaded yet. The AI SDK may also
				// throw during stream processing. Catch all errors gracefully.
				const errorText =
					"Apple Intelligence could not generate a response. The on-device model may still be downloading, please check Settings > Apple Intelligence & Siri and try again.";
				onToken(errorText);
				return {
					content: content + errorText,
					finishReason: "error",
				};
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
			const status = store.getCell(
				"aiProviders",
				"apple-models",
				"status",
			) as string;
			return status === "ready";
		},

		getSystemMessage(_conversationMessages: CompletionMessage[]): string {
			return `You are a 100% private on-device AI chat called Whisper. Conversations stay on the device. Help the user concisely. Be useful, creative, and accurate. Today's date is ${new Date().toLocaleString()}.`;
		},

		getContextSize(): number {
			return 4096;
		},

		getMultimodalCapabilities(): MultimodalCapabilities {
			return NO_MULTIMODAL;
		},

		getToolCapabilities(): ToolCapabilities {
			// Apple Intelligence supports native tools via createAppleProvider().
			// Tools are registered with execute functions — the native layer
			// calls them during generation and feeds results back to the model.
			return {
				supported: true,
				nativeToolCalling: true,
				promptFallback: true,
				maxActiveTools: 3,
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
