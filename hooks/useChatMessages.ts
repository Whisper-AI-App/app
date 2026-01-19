import { mainStore } from "@/src/stores/main/main-store";
import { useMemo } from "react";
import type { IMessage } from "react-native-gifted-chat";
import { useRowIds } from "tinybase/ui-react";

/**
 * Hook to fetch and transform chat messages from TinyBase to GiftedChat format.
 * Subscribes to messages table and filters by chatId.
 *
 * @param chatId - The chat ID to filter messages by
 * @returns Array of IMessage objects sorted by date (newest first for inverted list)
 */
export function useChatMessages(chatId: string | undefined): IMessage[] {
	const allMessageIds = useRowIds("messages");

	const messages = useMemo(() => {
		if (!chatId) return [];

		const chatMessages = allMessageIds
			.map((id) => {
				const msg = mainStore.getRow("messages", id);
				if (msg?.chatId !== chatId) return null;

				return {
					_id: msg.id,
					text: msg.contents,
					createdAt: new Date(msg.createdAt as string),
					user: {
						_id: msg.role === "user" ? 1 : 2,
						name: msg.role === "user" ? "You" : "AI",
					},
				} as IMessage;
			})
			.filter(Boolean) as IMessage[];

		// Sort by date descending (GiftedChat expects newest first)
		return chatMessages.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);
	}, [chatId, allMessageIds]);

	return messages;
}
