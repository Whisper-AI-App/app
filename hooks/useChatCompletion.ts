import { useAIChat } from "@/contexts/AIChatContext";
import { upsertChat } from "@/src/actions/chat";
import { upsertMessage } from "@/src/actions/message";
import type {
	UseChatCompletionOptions,
	UseChatCompletionReturn,
} from "@/src/types/chat";
import * as Haptics from "expo-haptics";
import { useCallback, useMemo, useState } from "react";
import { useValue } from "tinybase/ui-react";
import { v4 as uuidv4 } from "uuid";
import { processSystemMessage, type WhisperLLMCard } from "whisper-llm-cards";

/**
 * Hook to manage AI completion orchestration.
 * Handles typing state, streaming text, conversation history,
 * haptic feedback, and saving responses to TinyBase.
 */
export function useChatCompletion(
	options: UseChatCompletionOptions,
): UseChatCompletionReturn {
	const { chatId, messages, onChatCreated, folderId } = options;

	const [isAiTyping, setIsAiTyping] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const aiChat = useAIChat();

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

	const sendMessage = useCallback(
		async (text: string) => {
			if (!text.trim()) return;

			let activeChatId = chatId;

			// Create new chat if this is the first message
			if (!activeChatId) {
				activeChatId = uuidv4();
				const chatName = text.slice(0, 50); // Use first 50 chars as name
				upsertChat(activeChatId, chatName, folderId);
				onChatCreated?.(activeChatId);
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
					const conversationMessages = messages.map((msg) => ({
						role: msg.user._id === 1 ? ("user" as const) : ("system" as const),
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

					// Stream AI completion
					// Get system message from the current model card in store
					const systemMessage = aiChatModelCard
						? processSystemMessage(aiChatModelCard, conversationMessages)
						: `You are a 100% private on-device AI chat called Whisper. Conversations stay on the device. Help the user concisly. Be useful, creative, and accurate. Today's date is ${new Date().toLocaleString()}.`;

					const response = await aiChat.completion(
						[
							// System Message from card
							{
								role: "system",
								content: systemMessage,
							},
							...conversationMessages,
						],
						(token) => {
							aiResponseText += token;
							setStreamingText((prev) => prev + token);
						},
					);

					// Save AI response
					if (response) {
						const aiMessageId = uuidv4();
						upsertMessage(aiMessageId, activeChatId, aiResponseText, "system");
						setStreamingText(""); // Clear streaming text after saving
					}
				} catch (error) {
					console.error("[useChatCompletion] AI completion error:", error);
					setStreamingText(""); // Clear on error too
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

	return {
		isAiTyping,
		streamingText,
		sendMessage,
	};
}
