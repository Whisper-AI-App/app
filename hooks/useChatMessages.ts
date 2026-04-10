import type { MessageStatus } from "@/src/types/chat";
import { useMemo } from "react";
import type { IMessage } from "react-native-gifted-chat";
import { useTable } from "tinybase/ui-react";

export interface StoredAttachment {
	id: string;
	type: string;
	uri: string;
	mimeType: string;
	fileName: string;
	fileSize: number;
	width: number;
	height: number;
	duration: number;
	alt: string;
	thumbnailUri: string;
}

export interface ChatMessage extends IMessage {
	providerId?: string;
	modelId?: string;
	attachments?: StoredAttachment[];
}

export interface UseChatMessagesResult {
	messages: ChatMessage[];
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
	const attachmentsTable = useTable("attachments");

	return useMemo(() => {
		if (!chatId)
			return {
				messages: [],
				lastAssistantStatus: null,
				lastAssistantId: null,
			};

		// Build a lookup of attachments by messageId
		const attachmentsByMessage = new Map<string, StoredAttachment[]>();
		for (const [, att] of Object.entries(attachmentsTable)) {
			if (!att?.messageId) continue;
			const msgId = att.messageId as string;
			if (!attachmentsByMessage.has(msgId)) {
				attachmentsByMessage.set(msgId, []);
			}
			attachmentsByMessage.get(msgId)?.push({
				id: att.id as string,
				type: att.type as string,
				uri: att.uri as string,
				mimeType: att.mimeType as string,
				fileName: att.fileName as string,
				fileSize: att.fileSize as number,
				width: att.width as number,
				height: att.height as number,
				duration: att.duration as number,
				alt: att.alt as string,
				thumbnailUri: att.thumbnailUri as string,
			});
		}

		const chatMessages = Object.entries(messagesTable)
			.map(([, msg]) => {
				if (msg?.chatId !== chatId) return null;
				// Hide tool result messages — they're internal context for the model
				if (msg.role === "tool") return null;

				const msgId = msg.id as string;
				return {
					_id: msgId,
					text: msg.contents as string,
					createdAt: new Date(msg.createdAt as string),
					status: (msg.status as string) || "done",
					providerId: (msg.providerId as string) || "",
					modelId: (msg.modelId as string) || "",
					attachments: attachmentsByMessage.get(msgId),
					user: {
						_id: msg.role === "user" ? 1 : 2,
						name: msg.role === "user" ? "You" : "AI",
					},
				};
			})
			.filter(Boolean) as (ChatMessage & { status: string })[];

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
		// and assistant messages that are just tool call placeholders
		const filteredMessages = chatMessages.filter(
			(msg) =>
				!(msg.text === "" && msg.status === "error") &&
				!(msg.user._id === 2 && msg.text === "(called tools)"),
		);

		// Merge consecutive AI messages into a single bubble for display
		const merged = filteredMessages.reduce<ChatMessage[]>((acc, msg) => {
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
				providerId: msg.providerId,
				modelId: msg.modelId,
				attachments: msg.attachments,
				user: msg.user,
			});
			return acc;
		}, []);

		return { messages: merged, lastAssistantStatus, lastAssistantId };
	}, [chatId, messagesTable, attachmentsTable]);
}
