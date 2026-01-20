import { Share } from "react-native";
import { mainStore } from "../stores/main/main-store";

export function upsertChat(id: string, name: string, folderId?: string | null) {
	const existingChat = mainStore.getRow("chats", id);

	mainStore.setRow("chats", id, {
		id,
		name,
		createdAt: existingChat?.createdAt || new Date().toISOString(),
		folderId: folderId ?? existingChat?.folderId ?? "",
	});
}

export function deleteChat(chatId: string) {
	mainStore.delRow("chats", chatId);

	// Also delete all messages associated with this chat
	const messageIds = mainStore.getRowIds("messages");
	messageIds.forEach((messageId) => {
		const message = mainStore.getRow("messages", messageId);
		if (message?.chatId === chatId) {
			mainStore.delRow("messages", messageId);
		}
	});
}

export function renameChat(chatId: string, newName: string) {
	const existingChat = mainStore.getRow("chats", chatId);
	if (existingChat) {
		mainStore.setRow("chats", chatId, {
			...existingChat,
			name: newName,
		});
	}
}

/**
 * Moves a chat to a folder or removes it from its current folder.
 * @param chatId - The ID of the chat to move
 * @param folderId - The ID of the target folder, or null to remove from folder
 */
export function moveChatToFolder(
	chatId: string,
	folderId: string | null,
): void {
	const existingChat = mainStore.getRow("chats", chatId);
	if (existingChat) {
		mainStore.setRow("chats", chatId, {
			...existingChat,
			folderId: folderId ?? "",
		});
	}
}

export async function shareChat(chatId: string) {
	const chat = mainStore.getRow("chats", chatId);
	if (!chat) {
		console.log("[shareChat] Chat not found:", chatId);
		return;
	}

	// Get all messages for this chat
	const messageIds = mainStore.getRowIds("messages");
	const chatMessages = messageIds
		.map((id) => {
			const msg = mainStore.getRow("messages", id);
			if (msg?.chatId !== chatId) return null;
			return {
				role: msg.role,
				contents: msg.contents,
				createdAt: msg.createdAt,
			};
		})
		.filter(Boolean)
		.sort(
			(a, b) =>
				new Date(a?.createdAt ?? 0).getTime() -
				new Date(b?.createdAt ?? 0).getTime(),
		);

	// Format chat as text
	let chatText = `Hi, sharing a chat I had with Whisper AI about "${(chat.name ?? "").replace(/[^a-zA-Z0-9 ]/g, "")}"\n\n`;

	chatMessages.forEach((msg) => {
		if (msg) {
			const sender = msg.role === "user" ? "Me" : "💬 Whisper AI";
			chatText += `${sender}:\n${msg.contents}\n\n`;
		}
	});

	chatText += `Conversation with Whisper, 100% private AI (https://usewhisper.org)`;

	console.log(
		"[shareChat] Attempting to share:",
		chatText.length,
		"characters",
	);

	try {
		const result = await Share.share({
			message: chatText,
		});

		console.log("[shareChat] Share result:", result);

		if (result.action === Share.sharedAction) {
			console.log("[shareChat] Successfully shared");
		} else if (result.action === Share.dismissedAction) {
			console.log("[shareChat] Share dismissed");
		}
	} catch (error) {
		console.error("[shareChat] Error sharing:", error);
		throw error;
	}
}
