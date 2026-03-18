import * as FileSystem from "expo-file-system";
import { mainStore } from "../stores/main/main-store";
import type { ProcessedAttachment } from "../ai-providers/types";

const ATTACHMENTS_DIR = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/attachments`;

/**
 * Returns the directory path for a message's attachments.
 */
function messageAttachmentsDir(messageId: string): string {
	return `${ATTACHMENTS_DIR}/${messageId}`;
}

/**
 * Ensures the attachments directory for a message exists.
 */
async function ensureDir(dirUri: string): Promise<void> {
	const dir = new FileSystem.Directory(dirUri);
	if (!dir.exists) {
		await dir.create();
	}
}

/**
 * Saves processed attachments to TinyBase and copies files to the attachments directory.
 */
export async function saveAttachments(
	messageId: string,
	processed: ProcessedAttachment[],
): Promise<void> {
	if (processed.length === 0) return;

	const destDir = messageAttachmentsDir(messageId);
	await ensureDir(ATTACHMENTS_DIR);
	await ensureDir(destDir);

	for (const attachment of processed) {
		// Copy processed file to attachments directory
		const ext = attachment.fileName.split(".").pop() || "bin";
		const destUri = `${destDir}/${attachment.id}.${ext}`;

		const srcFile = new FileSystem.File(attachment.uri);
		if (srcFile.exists) {
			await srcFile.copy(new FileSystem.File(destUri));
		}

		// Copy thumbnail if present
		let thumbnailUri = "";
		if (attachment.thumbnailUri) {
			const thumbDest = `${destDir}/${attachment.id}_thumb.jpg`;
			const thumbSrc = new FileSystem.File(attachment.thumbnailUri);
			if (thumbSrc.exists) {
				await thumbSrc.copy(new FileSystem.File(thumbDest));
				thumbnailUri = thumbDest;
			}
		}

		// Persist to TinyBase
		mainStore.setRow("attachments", attachment.id, {
			id: attachment.id,
			messageId,
			type: attachment.type,
			uri: destUri,
			mimeType: attachment.mimeType,
			fileName: attachment.fileName,
			fileSize: attachment.fileSize,
			width: attachment.width,
			height: attachment.height,
			duration: attachment.duration,
			alt: attachment.alt,
			thumbnailUri,
			createdAt: new Date().toISOString(),
		});
	}
}

/**
 * Returns all attachments for a given message.
 */
export function getAttachmentsByMessage(
	messageId: string,
): Array<{ id: string; [key: string]: unknown }> {
	const allIds = mainStore.getRowIds("attachments");
	return allIds
		.map((id) => {
			const row = mainStore.getRow("attachments", id);
			return { id, ...row };
		})
		.filter((row) => row.messageId === messageId);
}

/**
 * Cascade-deletes all attachments for a message (TinyBase rows + filesystem).
 */
export async function deleteAttachmentsByMessage(
	messageId: string,
): Promise<void> {
	const attachments = getAttachmentsByMessage(messageId);

	// Delete TinyBase rows
	for (const attachment of attachments) {
		mainStore.delRow("attachments", attachment.id as string);
	}

	// Delete filesystem directory
	const dir = new FileSystem.Directory(messageAttachmentsDir(messageId));
	if (dir.exists) {
		await dir.delete();
	}
}
