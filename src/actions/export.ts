import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { createLogger } from "@/src/logger";
import { mainStore } from "../stores/main/main-store";
import { getProviderCredentials } from "./secure-credentials";

const logger = createLogger("Export");

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
 * @param includeSensitiveData - Whether to include API keys in the export
 * Returns the file URI if successful, or null if there are no chats to export.
 */
export async function exportAllChats(
	format: ExportFormat = "markdown",
	includeSensitiveData = false,
): Promise<string | null> {
	const chats = getAllChatsData();

	if (chats.length === 0) {
		logger.info("no chats to export");
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

	// Append credentials if sensitive data toggle is on
	if (includeSensitiveData) {
		const providerIds = mainStore.getRowIds("aiProviders");
		const credentialSections: string[] = [];

		for (const providerId of providerIds) {
			const creds = await getProviderCredentials(providerId);
			if (Object.keys(creds).length > 0) {
				if (format === "markdown") {
					credentialSections.push(`## Provider Credentials: ${providerId}`);
					for (const [field, value] of Object.entries(creds)) {
						credentialSections.push(`- **${field}**: ${value}`);
					}
					credentialSections.push("");
				} else {
					// JSON: will be included as a separate section
					credentialSections.push(
						`"credentials_${providerId}": ${JSON.stringify(creds, null, 2)}`,
					);
				}
			}
		}

		if (credentialSections.length > 0) {
			if (format === "markdown") {
				content += `\n---\n\n# Sensitive Data (API Keys)\n\n${credentialSections.join("\n")}\n`;
			} else {
				// For JSON, parse, add credentials, re-stringify
				try {
					const parsed = JSON.parse(content);
					for (const providerId of providerIds) {
						const creds = await getProviderCredentials(providerId);
						if (Object.keys(creds).length > 0) {
							parsed[`credentials_${providerId}`] = creds;
						}
					}
					content = JSON.stringify(parsed, null, 2);
				} catch {
					// Fallback: append as comment
				}
			}
		}
	}

	logger.info("export content generated", { format, characters: content.length });

	let tempFile: FileSystem.File | null = null;

	try {
		// Create a unique filename in cache directory
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
		const fileName = `whisper-export-${timestamp}.${extension}`;
		const cacheDir = new FileSystem.Directory(FileSystem.Paths.cache);
		tempFile = new FileSystem.File(cacheDir, fileName);

		// Write to file using new File API
		await tempFile.write(content);

		const fileUri = tempFile.uri;
		logger.info("file written", { fileUri });

		// Check if sharing is available
		const isAvailable = await Sharing.isAvailableAsync();
		if (!isAvailable) {
			logger.warn("sharing not available on this device");
			return fileUri;
		}

		// Share the file
		await Sharing.shareAsync(fileUri, {
			mimeType,
			dialogTitle: `Export Whisper Chats (${format.toUpperCase()})`,
		});

		logger.info("shared successfully");
		return fileUri;
	} catch (error) {
		logger.error("error exporting", { error: error instanceof Error ? error.message : String(error) });
		throw error;
	} finally {
		// Clean up temp file after sharing completes or is cancelled
		if (tempFile) {
			try {
				if (tempFile.exists) {
					await tempFile.delete();
				}
			} catch {
				// Non-critical: cache files are cleaned up by the OS eventually
			}
		}
	}
}

/**
 * Gets a summary of all chats for preview purposes.
 * Returns the total number of chats and messages.
 */
export function getChatsSummary(): { chatCount: number; messageCount: number } {
	const chatIds = mainStore.getRowIds("chats");

	// Count messages only from existing chats
	let messageCount = 0;
	const messageIds = mainStore.getRowIds("messages");
	for (const messageId of messageIds) {
		const msg = mainStore.getRow("messages", messageId);
		if (msg?.chatId && chatIds.includes(msg.chatId)) {
			messageCount++;
		}
	}

	return {
		chatCount: chatIds.length,
		messageCount,
	};
}
