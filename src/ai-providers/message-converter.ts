import * as FileSystem from "expo-file-system";
import type { CompletionMessage, CompletionMessagePart } from "./types";

/**
 * Reads a local file URI and returns base64 data.
 */
async function readFileAsBase64(uri: string): Promise<string> {
	const file = new FileSystem.File(uri);
	if (!file.exists) {
		throw new Error(`File not found: ${uri}`);
	}
	// expo-file-system new API: read as base64
	const base64 = file.base64();
	return base64;
}

/**
 * Options for cloud provider message conversion.
 */
interface ConvertOptions {
	/** Whether the cloud model natively supports audio input */
	supportsNativeAudio?: boolean;
}

/**
 * Convert CompletionMessage[] with multimodal content parts
 * into the format expected by Vercel AI SDK's streamText().
 *
 * The AI SDK accepts messages with content as an array of
 * { type: 'text', text } | { type: 'image', image: base64, mimeType } | { type: 'file', data: base64, mimeType, filename }
 *
 * For audio:
 * - If the cloud model supports native audio: send as FilePart (base64 + mediaType)
 * - Otherwise: use alt text fallback (STT transcription happens at the preprocessing layer)
 */
/** Messages with only the roles that AI SDK streamText() accepts. */
export type AISDKCompatibleMessage = {
	role: "user" | "assistant" | "system";
	content: string | CompletionMessagePart[];
};

export async function convertMessagesForAISDK(
	messages: CompletionMessage[],
	options?: ConvertOptions,
): Promise<AISDKCompatibleMessage[]> {
	const converted: AISDKCompatibleMessage[] = [];

	for (const msg of messages) {
		// Convert "tool" role messages to "user" role for AI SDK compatibility.
		// The AI SDK has its own tool result format; we pass tool results as user text.
		if (msg.role === "tool") {
			const content = typeof msg.content === "string"
				? msg.content
				: msg.content.map((p) => ("text" in p ? (p as { text: string }).text : "")).join("\n");
			converted.push({
				role: "user",
				content: `[Tool Result] ${content}`,
			});
			continue;
		}

		if (typeof msg.content === "string") {
			converted.push({ role: msg.role as "user" | "assistant" | "system", content: msg.content });
			continue;
		}

		const parts = msg.content as CompletionMessagePart[];
		const aiParts: unknown[] = [];

		for (const part of parts) {
			switch (part.type) {
				case "text":
					aiParts.push({ type: "text", text: part.text });
					break;
				case "image":
					try {
						const imageBase64 = await readFileAsBase64(part.uri);
						aiParts.push({
							type: "image",
							image: imageBase64,
							mimeType: part.mimeType,
						});
					} catch {
						// Fallback to alt text
						aiParts.push({ type: "text", text: `[${part.alt}]` });
					}
					break;
				case "file":
					try {
						const fileBase64 = await readFileAsBase64(part.uri);
						aiParts.push({
							type: "file",
							data: fileBase64,
							mimeType: part.mimeType,
							filename: part.fileName,
						});
					} catch {
						aiParts.push({ type: "text", text: `[${part.alt}]` });
					}
					break;
				case "audio":
					if (options?.supportsNativeAudio) {
						// Cloud model natively supports audio — send as file
						try {
							const audioBase64 = await readFileAsBase64(part.uri);
							aiParts.push({
								type: "file",
								data: audioBase64,
								mimeType: `audio/${part.format}`,
							});
						} catch {
							aiParts.push({ type: "text", text: `[${part.alt}]` });
						}
					} else {
						// No native audio support — use alt text fallback.
						// If STT transcription succeeded, the hook already sent
						// the transcription as a text part and this path is not
						// reached. This handles transcription-unavailable cases.
						aiParts.push({ type: "text", text: `[${part.alt}]` });
					}
					break;
			}
		}

		converted.push({
			role: msg.role as "user" | "assistant" | "system",
			content: aiParts as CompletionMessagePart[],
		});
	}

	return converted;
}
