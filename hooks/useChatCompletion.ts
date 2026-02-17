import { type AIChatMessage, useAIChat } from "@/contexts/AIChatContext";
import { upsertChat } from "@/src/actions/chat";
import { upsertMessage } from "@/src/actions/message";
import type {
	ChatNotice,
	CompletionResult,
	UseChatCompletionOptions,
	UseChatCompletionReturn,
} from "@/src/types/chat";
import { truncateMessages } from "@/src/utils/context-window";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useRef, useState } from "react";
import { useValue } from "tinybase/ui-react";
import { v4 as uuidv4 } from "uuid";
import { processSystemMessage, type WhisperLLMCard } from "whisper-llm-cards";

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
	const [isCutOff, setIsCutOff] = useState(false);
	const [lastAiMessageId, setLastAiMessageId] = useState<string | null>(null);
	const [chatNotice, setChatNotice] = useState<ChatNotice | null>(null);
	const aiChat = useAIChat();

	// Refs to store state for manual continue
	const continueStateRef = useRef<{
		activeChatId: string;
		conversationMessages: AIChatMessage[];
		systemMessage: string;
		accumulatedText: string;
	} | null>(null);

	// Get the current AI model card from store
	const aiChatModelCardJson = useValue("ai_chat_model_card");
	const aiChatModelCard: WhisperLLMCard | null = useMemo(() => {
		if (!aiChatModelCardJson) return null;
		try {
			return JSON.parse(aiChatModelCardJson as string);
		} catch {
			return null;
		}
	}, [aiChatModelCardJson]);

	/**
	 * Check if a completion result indicates the response was cut off
	 * (not a natural end-of-sequence stop).
	 */
	const isResponseCutOff = (result: CompletionResult): boolean => {
		return (
			!result.stopped_eos && !result.context_full && result.tokens_predicted > 0
		);
	};

	/**
	 * Run a single completion call, streaming tokens into the current streamingText.
	 */
	const runCompletion = async (
		completionMessages: AIChatMessage[],
		accumulatedText: string,
		partialCallback: (token: string) => void,
	): Promise<{ result: CompletionResult | null; fullText: string }> => {
		let currentText = accumulatedText;
		const result = await aiChat.completion(completionMessages, (token) => {
			currentText += token;
			partialCallback(token);
		});
		return { result, fullText: currentText };
	};

	const sendMessage = useCallback(
		async (text: string) => {
			if (!text.trim()) return;

			// Reset cutoff and notice state for new message
			setIsCutOff(false);
			setIsContinuing(false);
			setChatNotice(null);
			setLastAiMessageId(null);
			continueStateRef.current = null;

			let activeChatId = chatId;

			// Create new chat if this is the first message
			if (!activeChatId) {
				activeChatId = uuidv4();
				const chatName = text.slice(0, 50); // Use first 50 chars as name
				upsertChat(activeChatId, chatName, folderId);
				onChatCreated?.(activeChatId);
				await aiChat.clearCache();
			}

			// Save user message
			const userMessageId = uuidv4();
			upsertMessage(userMessageId, activeChatId, text, "user");

			// Get AI response
			if (aiChat.isLoaded) {
				setIsAiTyping(true);
				setStreamingText(""); // Clear any previous streaming text

				// Start periodic haptic feedback
				let hapticInterval: ReturnType<typeof setInterval> | null = null;
				if (process.env.EXPO_OS === "ios") {
					// Trigger initial haptic immediately
					Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

					// Then trigger periodically
					hapticInterval = setInterval(() => {
						Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
					}, 600); // Every 600ms for consistent rhythm
				}

				try {
					// Prepare conversation history
					// user._id === 1 is user, 2 is AI (GiftedChat convention)
					// Map both "system" (old data) and "assistant" (new data) to "assistant"
					const conversationMessages: AIChatMessage[] = messages.map((msg) => ({
						role:
							msg.user._id === 1 ? ("user" as const) : ("assistant" as const),
						content: msg.text,
					}));

					// Add the new user message
					conversationMessages.unshift({
						role: "user" as const,
						content: text,
					});

					// Reverse to chronological order for AI
					conversationMessages.reverse();

					let aiResponseText = "";

					// Get system message from the current model card in store
					const systemMessage = aiChatModelCard
						? processSystemMessage(aiChatModelCard, conversationMessages)
						: `You are a 100% private on-device AI chat called Whisper. Conversations stay on the device. Help the user concisely. Be useful, creative, and accurate. Today's date is ${new Date().toLocaleString()}.`;

					// Apply sliding context window to prevent overflow
					const truncatedMessages = truncateMessages(
						systemMessage,
						conversationMessages,
						aiChat.contextSize,
					);

					const completionMessages: AIChatMessage[] = [
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
						);
						setStreamingText("");
						setLastAiMessageId(aiMessageId);

						// Auto-continue loop (up to MAX_AUTO_CONTINUES times)
						let continueCount = 0;
						let accumulatedText = aiResponseText;

						while (
							lastResult &&
							isResponseCutOff(lastResult) &&
							continueCount < MAX_AUTO_CONTINUES
						) {
							continueCount++;
							setStreamingText("");

							const autoContinueMessages: AIChatMessage[] = [
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
							lastResult = await aiChat.completion(
								autoContinueMessages,
								(token) => {
									newText += token;
									setStreamingText((prev) => prev + token);
								},
							);

							if (newText) {
								const newMsgId = uuidv4();
								upsertMessage(newMsgId, activeChatId, newText, "assistant");
								setStreamingText("");
								setLastAiMessageId(newMsgId);
								accumulatedText = accumulatedText + newText;
							}
						}

						// Check if still cut off after auto-continues
						if (lastResult && isResponseCutOff(lastResult)) {
							setIsCutOff(true);
							continueStateRef.current = {
								activeChatId,
								conversationMessages: truncatedMessages,
								systemMessage,
								accumulatedText,
							};
						}
					} else {
						setStreamingText(""); // Clear on empty response
					}
				} catch (error) {
					console.error("[useChatCompletion] AI completion error:", error);
					setStreamingText(""); // Clear on error too
					setChatNotice({
						type: "error",
						message: "Something went wrong. Try sending your message again.",
					});
				} finally {
					// Stop periodic haptics
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
		[chatId, messages, aiChat, aiChatModelCard, onChatCreated, folderId],
	);

	const continueMessage = useCallback(async () => {
		const state = continueStateRef.current;
		if (!state || !aiChat.isLoaded) return;

		setIsCutOff(false);
		setChatNotice(null);
		setIsContinuing(true);
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
			const continueMessages: AIChatMessage[] = [
				{ role: "system", content: state.systemMessage },
				...state.conversationMessages,
				{ role: "assistant", content: state.accumulatedText },
				{ role: "user", content: "Continue from where you left off." },
			];

			let newResponseText = "";
			const result = await aiChat.completion(continueMessages, (token) => {
				newResponseText += token;
				setStreamingText((prev) => prev + token);
			});

			// Save as a new message
			if (newResponseText) {
				const newAiMessageId = uuidv4();
				upsertMessage(
					newAiMessageId,
					state.activeChatId,
					newResponseText,
					"assistant",
				);
				setStreamingText("");

				// Check if still cut off
				if (result && isResponseCutOff(result)) {
					setIsCutOff(true);
					setLastAiMessageId(newAiMessageId);
					state.accumulatedText = state.accumulatedText + newResponseText;
				} else {
					continueStateRef.current = null;
				}
			} else {
				setStreamingText("");
			}
		} catch (error) {
			console.error("[useChatCompletion] Continue error:", error);
			setStreamingText("");
			setChatNotice({
				type: "error",
				message: "Couldn't continue the response. Try again.",
			});
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
	}, [aiChat]);

	const stopGeneration = useCallback(() => {
		aiChat.stopCompletion();
	}, [aiChat]);

	return {
		isAiTyping,
		isContinuing,
		streamingText,
		sendMessage,
		stopGeneration,
		// PR features
		isCutOff,
		lastAiMessageId,
		continueMessage: isCutOff ? continueMessage : null,
		chatNotice,
		// Main feature
		clearInferenceCache: aiChat.clearCache,
	};
}
