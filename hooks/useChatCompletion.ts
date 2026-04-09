import { useAIProvider } from "@/contexts/AIProviderContext";
import { saveAttachments } from "@/src/actions/attachment";
import { upsertChat } from "@/src/actions/chat";
import { upsertMessage } from "@/src/actions/message";
import { defaultPreprocessMedia } from "@/src/ai-providers/media-preprocessor";
import type {
	CompletionMessage,
	CompletionMessagePart,
	CompletionResult,
	PendingAttachment,
	ProcessedAttachment,
	TextMessagePart,
} from "@/src/ai-providers/types";
import { createLogger } from "@/src/logger";
import { getTranscription } from "@/src/stt";
import { enrichAltText } from "@/src/utils/alt-text";
import type {
	UseChatCompletionOptions,
	UseChatCompletionReturn,
} from "@/src/types/chat";
import { truncateMessages } from "@/src/utils/context-window";
import { toolRegistry } from "@/src/tools/registry";
import { buildToolSystemPrompt } from "@/src/tools/prompt-formatter";
import {
	parseToolCallsFromText,
	isToolCallInCodeBlock,
} from "@/src/tools/parser";
import { executeToolCalls } from "@/src/tools/executor";
import {
	buildCorrectionPrompt,
	truncateToolResult,
} from "@/src/tools/error-correction";
import type { ToolCall, ToolResult } from "@/src/tools/types";
import type { ToolDefinition } from "@/src/tools/types";
import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import { useStore } from "tinybase/ui-react";
import { v4 as uuidv4 } from "uuid";

const logger = createLogger("ChatCompletion");

const MAX_AUTO_CONTINUES = 0;
const MAX_TOOL_STEPS = 5;
const MAX_CORRECTION_ATTEMPTS = 2;

/**
 * Hook to manage AI completion orchestration.
 * Handles typing state, streaming text, conversation history,
 * haptic feedback, auto-continuation, tool execution, and saving responses to TinyBase.
 */
export function useChatCompletion(
	options: UseChatCompletionOptions,
): UseChatCompletionReturn {
	const { chatId, messages, onChatCreated, folderId } = options;

	const [isAiTyping, setIsAiTyping] = useState(false);
	const [isProcessingMedia, setIsProcessingMedia] = useState(false);
	const [isContinuing, setIsContinuing] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const [hasContinueContext, setHasContinueContext] = useState(false);
	const [activeToolCall, setActiveToolCall] = useState<{
		name: string;
		args: Record<string, unknown>;
	} | null>(null);
	const isSendingRef = useRef(false);

	const { activeProvider } = useAIProvider();
	const store = useStore();

	const getModelId = () =>
		activeProvider
			? ((store?.getCell(
					"aiProviders",
					activeProvider.id,
					"selectedModelId",
				) as string) || "")
			: "";

	// Refs to store state for manual continue
	const continueStateRef = useRef<{
		activeChatId: string;
		conversationMessages: CompletionMessage[];
		systemMessage: string;
		accumulatedText: string;
	} | null>(null);

	/**
	 * Check if a completion result indicates the response was cut off
	 */
	const isResponseCutOff = (result: CompletionResult): boolean => {
		return result.finishReason === "length";
	};

	/**
	 * Run a single completion call, streaming tokens into the current streamingText.
	 * Optionally passes tool definitions to the provider for native tool calling.
	 */
	const runCompletion = async (
		completionMessages: CompletionMessage[],
		accumulatedText: string,
		partialCallback: (token: string) => void,
		tools?: ToolDefinition[],
	): Promise<{ result: CompletionResult | null; fullText: string }> => {
		if (!activeProvider) {
			return { result: null, fullText: accumulatedText };
		}

		let currentText = accumulatedText;
		const result = await activeProvider.completion(
			completionMessages,
			(token) => {
				currentText += token;
				partialCallback(token);
			},
			tools && tools.length > 0 ? { tools } : undefined,
		);
		return { result, fullText: currentText };
	};

	const sendMessage = useCallback(
		async (text: string, pendingAttachments?: PendingAttachment[]) => {
			if (
				!text.trim() &&
				(!pendingAttachments || pendingAttachments.length === 0)
			)
				return;

			// Prevent concurrent sends (double-tap, etc.)
			if (isSendingRef.current) return;
			isSendingRef.current = true;

			try {
				// Reset state for new message
				setIsContinuing(false);
				setHasContinueContext(false);
				continueStateRef.current = null;

				let activeChatId = chatId;

				// Create new chat if this is the first message
				if (!activeChatId) {
					activeChatId = uuidv4();
					const chatName = text.slice(0, 50) || "Voice message";
					upsertChat(activeChatId, chatName, folderId);
					onChatCreated?.(activeChatId);
					await activeProvider?.clearCache?.();
				}

				const userMessageId = uuidv4();
				const modelId = getModelId();

				// ── Phase 1: Pre-process media (transcription, image resize) ──
				let userContent: string | CompletionMessagePart[] = text;
				let displayText = text;
				let processedAttachments: ProcessedAttachment[] = [];

				if (
					pendingAttachments &&
					pendingAttachments.length > 0 &&
					activeProvider
				) {
					// Only show processing indicator when audio needs transcription at send-time
					// (i.e. no pre-computed transcription from eager STT)
					const needsLiveTranscription = pendingAttachments.some(
						(a) => a.type === "audio" && !a.transcription,
					);
					if (needsLiveTranscription) {
						setIsProcessingMedia(true);
					}
					try {
						const capabilities =
							activeProvider.getMultimodalCapabilities();
						const preprocessFn =
							activeProvider.preprocessMedia ??
							defaultPreprocessMedia;
						const processed = await preprocessFn(
							pendingAttachments,
							capabilities,
						);
						processedAttachments = processed;

						// Build multimodal content parts
						const parts: CompletionMessagePart[] = [];
						if (text.trim()) {
							parts.push({ type: "text", text });
						}

						// Match processed attachments back to pending to find pre-computed transcriptions
						const transcriptionById = new Map<string, string>();
						for (const pa of pendingAttachments) {
							if (pa.transcription) {
								transcriptionById.set(pa.id, pa.transcription);
							}
						}

						for (const att of processed) {
							if (att.type === "image") {
								if (capabilities.vision) {
									parts.push({
										type: "image",
										uri: att.uri,
										mimeType: att.mimeType,
										alt: att.alt,
									});
								} else {
									parts.push({
										type: "text",
										text: `[${att.alt}]`,
									});
								}
							} else if (att.type === "audio") {
								// Use pre-computed transcription if available, otherwise transcribe now
								let transcription =
									transcriptionById.get(att.id) ?? "";
								if (!transcription) {
									try {
										transcription = await getTranscription(
											att.uri,
											att.duration
												? att.duration * 1000
												: undefined,
										);
									} catch (sttError) {
										logger.warn("STT transcription failed", { error: sttError instanceof Error ? sttError.message : String(sttError) });

									}
								}

								if (transcription?.trim()) {
									parts.push({
										type: "text",
										text: transcription,
									});
									enrichAltText(att.id, transcription);
								} else {
									logger.warn("STT returned empty", { attachmentId: att.id });

									const durationInfo = att.duration
										? `${Math.round(att.duration)}s`
										: "unknown duration";
									parts.push({
										type: "audio",
										uri: att.uri,
										format: att.mimeType.includes("mp3")
											? "mp3"
											: "wav",
										alt: `Voice message (${durationInfo}). Automatic transcription was not available.`,
									});
								}
							} else if (att.type === "file") {
								if (capabilities.files) {
									parts.push({
										type: "file",
										uri: att.uri,
										mimeType: att.mimeType,
										fileName: att.fileName,
										alt: att.alt,
									});
								} else {
									parts.push({
										type: "text",
										text: `[${att.alt}]`,
									});
								}
							}
						}

						if (parts.length > 0) {
							userContent = parts;
						}

						// Derive display text for the message bubble
						if (!text.trim()) {
							const derived = parts
								.filter(
									(p): p is TextMessagePart =>
										p.type === "text",
								)
								.map((p) => p.text)
								.join("\n");
							if (derived) {
								displayText = derived;
							}
						}
					} catch (error) {
						logger.warn("Preprocessing failed, sending text only", { error });

					} finally {
						setIsProcessingMedia(false);
					}
				}

				// ── Phase 2: Save user message (with final display text) ──
				upsertMessage(
					userMessageId,
					activeChatId,
					displayText,
					"user",
					activeProvider?.id,
					modelId,
					"done",
				);

				if (processedAttachments.length > 0) {
					await saveAttachments(userMessageId, processedAttachments);
				}

				// ── Phase 3: AI completion with tool execution loop ──
				if (activeProvider?.isConfigured()) {
					setIsAiTyping(true);
					setStreamingText("");

					let hapticInterval: ReturnType<typeof setInterval> | null =
						null;
					if (process.env.EXPO_OS === "ios") {
						Haptics.impactAsync(
							Haptics.ImpactFeedbackStyle.Light,
						);
						hapticInterval = setInterval(() => {
							Haptics.impactAsync(
								Haptics.ImpactFeedbackStyle.Light,
							);
						}, 600);
					}

					try {
						// Prepare conversation history
						const conversationMessages: CompletionMessage[] =
							messages.map((msg) => ({
								role:
									msg.user._id === 1
										? ("user" as const)
										: ("assistant" as const),
								content: msg.text,
							}));

						conversationMessages.unshift({
							role: "user" as const,
							content: userContent,
						});

						// Reverse to chronological order for AI
						conversationMessages.reverse();

						const systemMessage =
							activeProvider.getSystemMessage(
								conversationMessages,
							);

						const contextSize = activeProvider.getContextSize();
						const mmCapabilities =
							activeProvider.getMultimodalCapabilities();
						const truncatedMessages = truncateMessages(
							systemMessage,
							conversationMessages,
							contextSize,
							mmCapabilities.constraints.imageMaxTokens,
						);

						// ── Tool setup ──
						const toolCapabilities =
							activeProvider.getToolCapabilities();
						const activeTools = toolCapabilities.supported
							? toolRegistry
									.getActiveTools()
									.slice(0, toolCapabilities.maxActiveTools)
							: [];

						// For prompt fallback, inject tool definitions into system message
						let effectiveSystemMessage = systemMessage;
						if (
							activeTools.length > 0 &&
							!toolCapabilities.nativeToolCalling &&
							toolCapabilities.promptFallback
						) {
							const toolPrompt =
								buildToolSystemPrompt(activeTools);
							effectiveSystemMessage = `${systemMessage}\n\n${toolPrompt}`;
						}

						let completionMessages: CompletionMessage[] = [
							{
								role: "system",
								content: effectiveSystemMessage,
							},
							...truncatedMessages,
						];

						// ── Tool execution loop ──
						let toolSteps = 0;
						let correctionAttempts = 0;
						let lastResult: CompletionResult | null = null;
						let aiResponseText = "";

						toolLoop: while (toolSteps <= MAX_TOOL_STEPS) {
							// Run completion (pass tools for native path)
							const nativeTools =
								toolCapabilities.nativeToolCalling
									? activeTools
									: undefined;
							const { result, fullText } = await runCompletion(
								completionMessages,
								"",
								(token) => {
									setStreamingText(
										(prev) => prev + token,
									);
								},
								nativeTools,
							);
							lastResult = result;
							aiResponseText = fullText;

							if (!result) break;

							// Check for tool calls
							let toolCalls: ToolCall[] = [];

							if (
								result.finishReason === "tool_calls" &&
								result.toolCalls
							) {
								// Native tool calling path
								toolCalls = result.toolCalls;
							} else if (
								activeTools.length > 0 &&
								!toolCapabilities.nativeToolCalling &&
								aiResponseText
							) {
								// XML fallback path — parse tool calls from text
								if (
									!isToolCallInCodeBlock(aiResponseText)
								) {
									const parsed =
										parseToolCallsFromText(
											aiResponseText,
										);
									toolCalls = parsed.toolCalls;

									if (
										parsed.textContent !==
										aiResponseText
									) {
										aiResponseText =
											parsed.textContent;
									}

									// Handle malformed tool calls with correction
									if (
										parsed.hasMalformed &&
										toolCalls.length === 0 &&
										correctionAttempts <
											MAX_CORRECTION_ATTEMPTS
									) {
										correctionAttempts++;
										const correction =
											buildCorrectionPrompt(
												parsed.malformedPattern ||
													"Malformed tool call",
												activeTools,
											);
										completionMessages = [
											...completionMessages,
											{
												role: "assistant" as const,
												content: fullText,
											},
											{
												role: "system" as const,
												content: correction,
											},
										];
										setStreamingText("");
										continue toolLoop;
									}
								}
							}

							// No tool calls — we're done
							if (toolCalls.length === 0) break;

							toolSteps++;

							// Execute tool calls
							setStreamingText("");
							const toolResults: ToolResult[] = [];
							for (const tc of toolCalls) {
								setActiveToolCall({
									name: tc.name,
									args: tc.arguments,
								});
								const results = await executeToolCalls([
									tc,
								]);
								toolResults.push(...results);
							}
							setActiveToolCall(null);

							// Save assistant message with tool calls (if it has text)
							if (aiResponseText.trim()) {
								const partialMsgId = uuidv4();
								upsertMessage(
									partialMsgId,
									activeChatId,
									aiResponseText,
									"assistant",
									activeProvider.id,
									modelId,
									"done",
									JSON.stringify(toolCalls),
								);
							}

							// Save tool results as a tool message
							const toolResultContent = toolResults
								.map((r) => {
									const tc = toolCalls.find(
										(c) => c.id === r.toolCallId,
									);
									const prefix = r.isError
										? "[Error] "
										: "";
									return `[${tc?.name || "unknown"}] ${prefix}${truncateToolResult(r.content, 4000)}`;
								})
								.join("\n\n");

							const toolMsgId = uuidv4();
							upsertMessage(
								toolMsgId,
								activeChatId,
								toolResultContent,
								"tool",
								activeProvider.id,
								modelId,
								"done",
								"",
								JSON.stringify(toolResults),
							);

							// Build next messages with tool context
							completionMessages = [
								...completionMessages,
								{
									role: "assistant" as const,
									content:
										aiResponseText || "(called tools)",
								},
							];
							for (const tr of toolResults) {
								const tc = toolCalls.find(
									(c) => c.id === tr.toolCallId,
								);
								completionMessages.push({
									role: "tool" as const,
									content: `[${tc?.name || "tool"}] ${truncateToolResult(tr.content, 4000)}`,
								});
							}

							setStreamingText("");
							correctionAttempts = 0;
						}

						// ── Save final AI response ──
						if (aiResponseText) {
							const aiMessageId = uuidv4();
							upsertMessage(
								aiMessageId,
								activeChatId,
								aiResponseText,
								"assistant",
								activeProvider.id,
								modelId,
								"done",
							);
							setStreamingText("");

							// Auto-continue loop
							let continueCount = 0;
							let accumulatedText = aiResponseText;

							while (
								lastResult &&
								isResponseCutOff(lastResult) &&
								continueCount < MAX_AUTO_CONTINUES
							) {
								continueCount++;
								setStreamingText("");

								const autoContinueMessages: CompletionMessage[] =
									[
										{
											role: "system",
											content:
												effectiveSystemMessage,
										},
										...truncatedMessages,
										{
											role: "assistant",
											content: accumulatedText,
										},
										{
											role: "system",
											content:
												"Your last response was cut off. Output ONLY the remaining text from the exact cutoff point. Do not restart or add preamble.",
										},
									];

								let newText = "";
								lastResult =
									await activeProvider.completion(
										autoContinueMessages,
										(token) => {
											newText += token;
											setStreamingText(
												(prev) => prev + token,
											);
										},
									);

								if (newText) {
									const newMsgId = uuidv4();
									upsertMessage(
										newMsgId,
										activeChatId,
										newText,
										"assistant",
										activeProvider.id,
										modelId,
										"done",
									);
									setStreamingText("");
									accumulatedText =
										accumulatedText + newText;
								}
							}

							// Determine final status based on finish reason
							if (
								lastResult &&
								isResponseCutOff(lastResult)
							) {
								upsertMessage(
									aiMessageId,
									activeChatId,
									accumulatedText === aiResponseText
										? aiResponseText
										: accumulatedText,
									"assistant",
									activeProvider.id,
									modelId,
									"length",
								);
								setHasContinueContext(true);
								continueStateRef.current = {
									activeChatId,
									conversationMessages:
										truncatedMessages,
									systemMessage:
										effectiveSystemMessage,
									accumulatedText,
								};
							} else if (
								lastResult?.finishReason === "cancelled"
							) {
								upsertMessage(
									aiMessageId,
									activeChatId,
									accumulatedText === aiResponseText
										? aiResponseText
										: accumulatedText,
									"assistant",
									activeProvider.id,
									modelId,
									"cancelled",
								);
								setHasContinueContext(true);
								continueStateRef.current = {
									activeChatId,
									conversationMessages:
										truncatedMessages,
									systemMessage:
										effectiveSystemMessage,
									accumulatedText,
								};
							}
						} else {
							setStreamingText("");
						}
					} catch (error) {
						logger.error("AI completion error", { error });

						setStreamingText("");
						const errorMsgId = uuidv4();
						upsertMessage(
							errorMsgId,
							activeChatId,
							"",
							"assistant",
							activeProvider.id,
							modelId,
							"error",
						);
					} finally {
						setActiveToolCall(null);
						if (hapticInterval) {
							clearInterval(hapticInterval);
						}
						setIsAiTyping(false);
						if (process.env.EXPO_OS === "ios") {
							Haptics.impactAsync(
								Haptics.ImpactFeedbackStyle.Rigid,
							);
						}
					}
				}
			} finally {
				isSendingRef.current = false;
			}
		},
		[chatId, messages, activeProvider, onChatCreated, folderId, store],
	);

	const continueMessage = useCallback(async () => {
		const state = continueStateRef.current;
		if (!state || !activeProvider?.isConfigured()) return;

		const modelId = getModelId();
		setHasContinueContext(false);
		setIsContinuing(true);
		setIsAiTyping(true);
		setStreamingText("");

		let hapticInterval: ReturnType<typeof setInterval> | null = null;
		if (process.env.EXPO_OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			hapticInterval = setInterval(() => {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			}, 600);
		}

		try {
			const continueMessages: CompletionMessage[] = [
				{ role: "system", content: state.systemMessage },
				...state.conversationMessages,
				{ role: "assistant", content: state.accumulatedText },
				{ role: "user", content: "Continue from where you left off." },
			];

			let newResponseText = "";
			const result = await activeProvider.completion(
				continueMessages,
				(token) => {
					newResponseText += token;
					setStreamingText((prev) => prev + token);
				},
			);

			if (newResponseText) {
				const newAiMessageId = uuidv4();

				if (result && isResponseCutOff(result)) {
					upsertMessage(
						newAiMessageId,
						state.activeChatId,
						newResponseText,
						"assistant",
						activeProvider.id,
						modelId,
						"length",
					);
					setStreamingText("");
					setHasContinueContext(true);
					state.accumulatedText =
						state.accumulatedText + newResponseText;
				} else if (result?.finishReason === "cancelled") {
					upsertMessage(
						newAiMessageId,
						state.activeChatId,
						newResponseText,
						"assistant",
						activeProvider.id,
						modelId,
						"cancelled",
					);
					setStreamingText("");
					setHasContinueContext(true);
					state.accumulatedText =
						state.accumulatedText + newResponseText;
				} else {
					upsertMessage(
						newAiMessageId,
						state.activeChatId,
						newResponseText,
						"assistant",
						activeProvider.id,
						modelId,
						"done",
					);
					setStreamingText("");
					continueStateRef.current = null;
				}
			} else {
				setStreamingText("");
			}
		} catch (error) {
			logger.error("Continue error", { error });
			setStreamingText("");
			// Create empty AI message with error status
			const errorMsgId = uuidv4();
			upsertMessage(
				errorMsgId,
				state.activeChatId,
				"",
				"assistant",
				activeProvider.id,
				modelId,
				"error",
			);
		} finally {
			if (hapticInterval) {
				clearInterval(hapticInterval);
			}
			setIsAiTyping(false);
			setIsContinuing(false);
			if (process.env.EXPO_OS === "ios") {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
			}
		}
	}, [activeProvider, store]);

	const stopGeneration = useCallback(() => {
		activeProvider?.stopCompletion();
	}, [activeProvider]);

	const clearInferenceCache = useCallback(async () => {
		await activeProvider?.clearCache?.();
	}, [activeProvider]);

	return {
		isAiTyping,
		isProcessingMedia,
		isContinuing,
		streamingText,
		activeToolCall,
		sendMessage,
		stopGeneration,
		continueMessage: hasContinueContext ? continueMessage : null,
		clearInferenceCache,
	};
}
