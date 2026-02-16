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
		chatMessages.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);

		// Merge consecutive AI messages into a single bubble for display
		return chatMessages.reduce<IMessage[]>((acc, msg) => {
			const prev = acc[acc.length - 1];
			if (prev && prev.user._id === 2 && msg.user._id === 2) {
				// msg is older (array is newest-first), prepend its text before prev's
				prev.text = `${msg.text}\n\n${prev.text}`;
				return acc;
			}
			acc.push({ ...msg });
			return acc;
		}, []);
	}, [chatId, allMessageIds]);

	return messages;
}
