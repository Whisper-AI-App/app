import type { MessageStatus } from "@/src/types/chat";
import { useMemo } from "react";
import type { IMessage } from "react-native-gifted-chat";
import { useTable } from "tinybase/ui-react";

export interface UseChatMessagesResult {
	messages: IMessage[];
	lastAssistantStatus: MessageStatus | null;
	lastAssistantId: string | null;
}

/**
 * Hook to fetch and transform chat messages from TinyBase to GiftedChat format.
 * Subscribes to messages table and filters by chatId.
 * Uses useTable so cell-level changes (e.g. status updates) trigger re-renders.
 *
 * @param chatId - The chat ID to filter messages by
 * @returns Messages, last assistant status, and last assistant ID
 */
export function useChatMessages(
	chatId: string | undefined,
): UseChatMessagesResult {
	const messagesTable = useTable("messages");

	return useMemo(() => {
		if (!chatId)
			return {
				messages: [],
				lastAssistantStatus: null,
				lastAssistantId: null,
			};

		const chatMessages = Object.entries(messagesTable)
			.map(([, msg]) => {
				if (msg?.chatId !== chatId) return null;

				return {
					_id: msg.id as string,
					text: msg.contents as string,
					createdAt: new Date(msg.createdAt as string),
					status: (msg.status as string) || "done",
					providerId: (msg.providerId as string) || "",
					modelId: (msg.modelId as string) || "",
					user: {
						_id: msg.role === "user" ? 1 : 2,
						name: msg.role === "user" ? "You" : "AI",
					},
				};
			})
			.filter(Boolean) as (IMessage & { status: string; providerId: string; modelId: string })[];

		// Sort by date descending (GiftedChat expects newest first)
		chatMessages.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		// Find last assistant message status (newest first, so first assistant = last)
		const lastAssistant = chatMessages.find((m) => m.user._id === 2);
		const lastAssistantStatus =
			(lastAssistant?.status as MessageStatus) || null;
		const lastAssistantId = lastAssistant
			? (lastAssistant._id as string)
			: null;

		// Filter out empty-content error messages (they only carry status)
		const filteredMessages = chatMessages.filter(
			(msg) => !(msg.text === "" && msg.status === "error"),
		);

		// Merge consecutive AI messages into a single bubble for display
		const merged = filteredMessages.reduce<IMessage[]>((acc, msg) => {
			const prev = acc[acc.length - 1];
			if (prev && prev.user._id === 2 && msg.user._id === 2) {
				// msg is older (array is newest-first), prepend its text before prev's
				prev.text = `${msg.text}\n\n${prev.text}`;
				return acc;
			}
			acc.push({
				_id: msg._id,
				text: msg.text,
				createdAt: msg.createdAt,
				providerId: (msg as IMessage & { providerId: string; modelId: string }).providerId,
				modelId: (msg as IMessage & { providerId: string; modelId: string }).modelId,
				user: msg.user,
			} as IMessage);
			return acc;
		}, []);

		return { messages: merged, lastAssistantStatus, lastAssistantId };
	}, [chatId, messagesTable]);
}
