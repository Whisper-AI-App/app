import { mainStore } from "../stores/main/main-store";
import type { PendingAttachment, ProcessedAttachment } from "../ai-providers/types";

/**
 * Formats file size in human-readable form.
 */
function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Extracts the format from a MIME type (e.g., "image/jpeg" → "JPEG").
 */
function formatFromMime(mimeType: string): string {
	const subtype = mimeType.split("/")[1] || "unknown";
	return subtype.toUpperCase();
}

/**
 * Generates metadata-based alt text for an attachment.
 */
export function generateAltText(
	attachment: PendingAttachment | ProcessedAttachment,
): string {
	const format = formatFromMime(attachment.mimeType);

	switch (attachment.type) {
		case "image": {
			const dims =
				attachment.width && attachment.height
					? `${attachment.width}\u00D7${attachment.height} `
					: "";
			return `Image: ${dims}${format} (${formatSize(attachment.fileSize)})`;
		}
		case "file": {
			return `File: ${attachment.fileName} (${formatSize(attachment.fileSize)}, ${format})`;
		}
		default:
			return `Attachment: ${attachment.fileName}`;
	}
}

/**
 * Enriches an attachment's alt text with AI-generated description.
 * Called after the AI responds with descriptive content about the media.
 */
export function enrichAltText(
	attachmentId: string,
	aiDescription: string,
): void {
	const row = mainStore.getRow("attachments", attachmentId);
	if (row && aiDescription.trim()) {
		mainStore.setCell(
			"attachments",
			attachmentId,
			"alt",
			aiDescription.trim(),
		);
	}
}
