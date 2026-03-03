import { useAIProvider } from "@/contexts/AIProviderContext";
import { upsertChat } from "@/src/actions/chat";
import { upsertMessage } from "@/src/actions/message";
import type {
	UseChatCompletionOptions,
	UseChatCompletionReturn,
} from "@/src/types/chat";
import type {
	CompletionMessage,
	CompletionResult,
} from "@/src/ai-providers/types";
import { truncateMessages } from "@/src/utils/context-window";
import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import { useStore } from "tinybase/ui-react";
import { v4 as uuidv4 } from "uuid";

const MAX_AUTO_CONTINUES = 0;

/**
 * Hook to manage AI completion orchestration.
 * Handles typing state, streaming text, conversation history,
 * haptic feedback, auto-continuation, and saving responses to TinyBase.
 */
export function useChatCompletion(
	options: UseChatCompletionOptions,
): UseChatCompletionReturn {
	const { chatId, messages, onChatCreated, folderId } = options;

	const [isAiTyping, setIsAiTyping] = useState(false);
	const [isContinuing, setIsContinuing] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const [hasContinueContext, setHasContinueContext] = useState(false);

	const { activeProvider } = useAIProvider();
	const store = useStore();

	const getModelId = () =>
		activeProvider
			? (store?.getCell("aiProviders", activeProvider.id, "selectedModelId") as string) || ""
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
	 */
	const runCompletion = async (
		completionMessages: CompletionMessage[],
		accumulatedText: string,
		partialCallback: (token: string) => void,
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
		);
		return { result, fullText: currentText };
	};

	const sendMessage = useCallback(
		async (text: string) => {
			if (!text.trim()) return;

			// Reset state for new message
			setIsContinuing(false);
			setHasContinueContext(false);
			continueStateRef.current = null;

			let activeChatId = chatId;

			// Create new chat if this is the first message
			if (!activeChatId) {
				activeChatId = uuidv4();
				const chatName = text.slice(0, 50);
				upsertChat(activeChatId, chatName, folderId);
				onChatCreated?.(activeChatId);
				await activeProvider?.clearCache?.();
			}

			// Save user message
			const userMessageId = uuidv4();
			const modelId = getModelId();
			upsertMessage(
				userMessageId,
				activeChatId,
				text,
				"user",
				activeProvider?.id,
				modelId,
				"done",
			);

			// Get AI response
			if (activeProvider?.isConfigured()) {
				setIsAiTyping(true);
				setStreamingText("");

				// Start periodic haptic feedback
				let hapticInterval: ReturnType<typeof setInterval> | null = null;
				if (process.env.EXPO_OS === "ios") {
					Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
					hapticInterval = setInterval(() => {
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
					}, 600);
				}

				try {
					// Prepare conversation history
					const conversationMessages: CompletionMessage[] = messages.map(
						(msg) => ({
							role:
								msg.user._id === 1
									? ("user" as const)
									: ("assistant" as const),
							content: msg.text,
						}),
					);

					// Add the new user message
					conversationMessages.unshift({
						role: "user" as const,
						content: text,
					});

					// Reverse to chronological order for AI
					conversationMessages.reverse();

					let aiResponseText = "";

					// Get system message from provider
					const systemMessage =
						activeProvider.getSystemMessage(conversationMessages);

					// Apply sliding context window
					const contextSize = activeProvider.getContextSize();
					const truncatedMessages = truncateMessages(
						systemMessage,
						conversationMessages,
						contextSize,
					);

					const completionMessages: CompletionMessage[] = [
						{ role: "system", content: systemMessage },
						...truncatedMessages,
					];

					// Initial completion
					const { result, fullText } = await runCompletion(
						completionMessages,
						aiResponseText,
						(token) => {
							setStreamingText((prev) => prev + token);
						},
					);
					aiResponseText = fullText;

					// Save initial AI response
					let lastResult = result;
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

							const autoContinueMessages: CompletionMessage[] = [
								{ role: "system", content: systemMessage },
								...truncatedMessages,
								{ role: "assistant", content: accumulatedText },
								{
									role: "system",
									content:
										"Your last response was cut off. Output ONLY the remaining text from the exact cutoff point. Do not restart or add preamble.",
								},
							];

							let newText = "";
							lastResult = await activeProvider.completion(
								autoContinueMessages,
								(token) => {
									newText += token;
									setStreamingText((prev) => prev + token);
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
								accumulatedText = accumulatedText + newText;
							}
						}

						// Determine final status based on finish reason
						if (lastResult && isResponseCutOff(lastResult)) {
							// Update the last AI message status to "length"
							upsertMessage(
								aiMessageId,
								activeChatId,
								accumulatedText === aiResponseText ? aiResponseText : accumulatedText,
								"assistant",
								activeProvider.id,
								modelId,
								"length",
							);
							setHasContinueContext(true);
							continueStateRef.current = {
								activeChatId,
								conversationMessages: truncatedMessages,
								systemMessage,
								accumulatedText,
							};
						} else if (lastResult?.finishReason === "cancelled") {
							upsertMessage(
								aiMessageId,
								activeChatId,
								accumulatedText === aiResponseText ? aiResponseText : accumulatedText,
								"assistant",
								activeProvider.id,
								modelId,
								"cancelled",
							);
							setHasContinueContext(true);
							continueStateRef.current = {
								activeChatId,
								conversationMessages: truncatedMessages,
								systemMessage,
								accumulatedText,
							};
						}
					} else {
						setStreamingText("");
					}
				} catch (error) {
					console.error("[useChatCompletion] AI completion error:", error);
					setStreamingText("");
					// Create empty AI message with error status
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
					if (hapticInterval) {
						clearInterval(hapticInterval);
					}
					setIsAiTyping(false);
					if (process.env.EXPO_OS === "ios") {
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
					}
				}
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
					state.accumulatedText = state.accumulatedText + newResponseText;
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
					state.accumulatedText = state.accumulatedText + newResponseText;
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
			console.error("[useChatCompletion] Continue error:", error);
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
		isContinuing,
		streamingText,
		sendMessage,
		stopGeneration,
		continueMessage: hasContinueContext ? continueMessage : null,
		clearInferenceCache,
	};
}
