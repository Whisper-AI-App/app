import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { mainStore } from "../stores/main/main-store";

export type ExportFormat = "markdown" | "json";

interface ChatExport {
	id: string;
	name: string;
	createdAt: string;
	messages: Array<{
		role: string;
		contents: string;
		createdAt: string;
	}>;
}

/**
 * Gets all chats with their messages for export.
 */
function getAllChatsData(): ChatExport[] {
	const chatIds = mainStore.getRowIds("chats");

	// Sort chats by creation date (oldest first)
	return chatIds
		.map((id) => {
			const chat = mainStore.getRow("chats", id);
			if (!chat) return null;

			// Get all messages for this chat
			const messageIds = mainStore.getRowIds("messages");
			const chatMessages = messageIds
				.map((messageId) => {
					const msg = mainStore.getRow("messages", messageId);
					if (msg?.chatId !== id) return null;
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

			return {
				id,
				name: chat.name ?? "Untitled",
				createdAt: chat.createdAt ?? new Date().toISOString(),
				messages: chatMessages,
			};
		})
		.filter(Boolean)
		.sort(
			(a, b) =>
				new Date(a?.createdAt ?? 0).getTime() -
				new Date(b?.createdAt ?? 0).getTime(),
		) as ChatExport[];
}

/**
 * Converts chats to Markdown format.
 */
function convertToMarkdown(chats: ChatExport[]): string {
	let content = `# Whisper AI - Chat Export\n`;
	content += `Exported on: ${new Date().toLocaleString()}\n`;
	content += `Total conversations: ${chats.length}\n\n`;
	content += `---\n\n`;

	for (const chat of chats) {
		const chatName = chat.name.replace(/[^a-zA-Z0-9 ]/g, "");
		const createdAt = new Date(chat.createdAt).toLocaleDateString();

		content += `## ${chatName}\n`;
		content += `*Created: ${createdAt}*\n\n`;

		if (chat.messages.length === 0) {
			content += "*No messages*\n\n";
		} else {
			for (const msg of chat.messages) {
				const sender = msg.role === "user" ? "👤 You" : "💬 Whisper AI";
				content += `**${sender}:**\n${msg.contents}\n\n`;
			}
		}

		content += `---\n\n`;
	}

	content += `---\n\n`;
	content +=
		"Exported from Whisper - 100% private AI Chat\nhttps://usewhisper.org\n";

	return content;
}

/**
 * Converts chats to JSON format.
 */
function convertToJson(chats: ChatExport[]): string {
	const exportData = {
		exportDate: new Date().toLocaleString(),
		app: "Whisper AI",
		website: "https://usewhisper.org",
		conversations: chats.map((chat) => ({
			id: chat.id,
			name: chat.name,
			createdAt: chat.createdAt,
			messageCount: chat.messages.length,
			messages: chat.messages.map((msg) => ({
				role: msg.role,
				content: msg.contents,
				timestamp: msg.createdAt,
			})),
		})),
	};

	return JSON.stringify(exportData, null, 2);
}

/**
 * Exports all chats and their messages to a file and shares it.
 * @param format - The export format: "markdown" or "json"
 * Returns the file URI if successful, or null if there are no chats to export.
 */
export async function exportAllChats(
	format: ExportFormat = "markdown",
): Promise<string | null> {
	const chats = getAllChatsData();

	if (chats.length === 0) {
		console.log("[exportAllChats] No chats to export");
		return null;
	}

	// Generate content based on format
	let content: string;
	let mimeType: string;
	let extension: string;

	switch (format) {
		case "json":
			content = convertToJson(chats);
			mimeType = "application/json";
			extension = "json";
			break;
		case "markdown":
		default:
			content = convertToMarkdown(chats);
			mimeType = "text/markdown";
			extension = "md";
			break;
	}

	console.log(
		`[exportAllChats] Export content (${format}):`,
		content.length,
		"characters",
	);

	try {
		// Create a unique filename
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const fileName = `whisper-export-${timestamp}.${extension}`;
		const cacheDir = new FileSystem.Directory(FileSystem.Paths.cache);
		const file = new FileSystem.File(cacheDir, fileName);

		// Write to file using new File API
		await file.write(content);

		const fileUri = file.uri;
		console.log("[exportAllChats] File written to:", fileUri);

		// Check if sharing is available
		const isAvailable = await Sharing.isAvailableAsync();
		if (!isAvailable) {
			console.log("[exportAllChats] Sharing not available on this device");
			return fileUri;
		}

		// Share the file
		await Sharing.shareAsync(fileUri, {
			mimeType,
			dialogTitle: `Export Whisper Chats (${format.toUpperCase()})`,
		});

		console.log("[exportAllChats] Shared successfully");
		return fileUri;
	} catch (error) {
		console.error("[exportAllChats] Error exporting:", error);
		throw error;
	}
}

/**
 * Gets a summary of all chats for preview purposes.
 * Returns the total number of chats and messages.
 */
export function getChatsSummary(): { chatCount: number; messageCount: number } {
	const chatIds = mainStore.getRowIds("chats");
	const messageIds = mainStore.getRowIds("messages");

	return {
		chatCount: chatIds.length,
		messageCount: messageIds.length,
	};
}
