import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import type {
	PendingAttachment,
	ProcessedAttachment,
	MultimodalCapabilities,
} from "./types";
import { generateAltText } from "../utils/alt-text";

// Image compression settings
const INITIAL_COMPRESSION_QUALITY = 0.8;
const MIN_COMPRESSION_QUALITY = 0.3;
const QUALITY_STEP = 0.1;
const TARGET_IMAGE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB per image
const THUMBNAIL_SIZE = 150;

// File text preview length
const FILE_PREVIEW_CHARS = 500;

/**
 * Pre-processes an image: resize to provider constraints, compress, generate thumbnail.
 */
async function preprocessImage(
	attachment: PendingAttachment,
	capabilities: MultimodalCapabilities,
): Promise<ProcessedAttachment> {
	const { maxImageWidth, maxImageHeight } = capabilities.constraints;
	const targetWidth = maxImageWidth || 1024;
	const targetHeight = maxImageHeight || 1024;

	// Resize to fit within provider constraints
	const context = ImageManipulator.ImageManipulator.manipulate(attachment.uri);
	const resized = context.resize({ width: targetWidth, height: targetHeight });
	const rendered = await resized.renderAsync();

	// Compress with progressive quality reduction
	let quality = INITIAL_COMPRESSION_QUALITY;
	let result = await rendered.saveAsync({
		format: ImageManipulator.SaveFormat.JPEG,
		compress: quality,
	});

	const file = new FileSystem.File(result.uri);
	let fileSize = file.exists ? file.size ?? 0 : 0;

	while (fileSize > TARGET_IMAGE_SIZE_BYTES && quality > MIN_COMPRESSION_QUALITY) {
		quality -= QUALITY_STEP;
		result = await rendered.saveAsync({
			format: ImageManipulator.SaveFormat.JPEG,
			compress: quality,
		});
		const newFile = new FileSystem.File(result.uri);
		fileSize = newFile.exists ? newFile.size ?? 0 : 0;
	}

	// Generate thumbnail
	const thumbContext = ImageManipulator.ImageManipulator.manipulate(result.uri);
	const thumbResized = thumbContext.resize({
		width: THUMBNAIL_SIZE,
		height: THUMBNAIL_SIZE,
	});
	const thumbRendered = await thumbResized.renderAsync();
	const thumbResult = await thumbRendered.saveAsync({
		format: ImageManipulator.SaveFormat.JPEG,
		compress: 0.6,
	});

	const processed: ProcessedAttachment = {
		id: attachment.id,
		type: "image",
		uri: result.uri,
		mimeType: "image/jpeg",
		fileName: attachment.fileName,
		fileSize,
		width: result.width,
		height: result.height,
		duration: 0,
		alt: "",
		thumbnailUri: thumbResult.uri,
	};
	processed.alt = generateAltText(processed);

	return processed;
}

/**
 * Pre-processes audio: validates format, creates alt text.
 * Actual format conversion (resampling) deferred to provider-specific handling.
 */
async function preprocessAudio(
	attachment: PendingAttachment,
	_capabilities: MultimodalCapabilities,
): Promise<ProcessedAttachment> {
	const processed: ProcessedAttachment = {
		id: attachment.id,
		type: "audio",
		uri: attachment.uri,
		mimeType: attachment.mimeType,
		fileName: attachment.fileName,
		fileSize: attachment.fileSize,
		width: 0,
		height: 0,
		duration: attachment.duration ?? 0,
		alt: "",
		thumbnailUri: "",
	};
	processed.alt = generateAltText(processed);

	return processed;
}

/**
 * Pre-processes a file: validate type/size, extract text preview for alt.
 */
async function preprocessFile(
	attachment: PendingAttachment,
	capabilities: MultimodalCapabilities,
): Promise<ProcessedAttachment> {
	const { maxFileSize, supportedFileTypes } = capabilities.constraints;

	// Validate file size
	if (maxFileSize > 0 && attachment.fileSize > maxFileSize) {
		throw new Error(
			`File exceeds size limit: ${(attachment.fileSize / (1024 * 1024)).toFixed(1)}MB > ${(maxFileSize / (1024 * 1024)).toFixed(1)}MB`,
		);
	}

	// Validate file type
	const ext = attachment.fileName.split(".").pop()?.toLowerCase() || "";
	if (supportedFileTypes.length > 0 && !supportedFileTypes.includes(ext)) {
		throw new Error(
			`Unsupported file type: .${ext}. Supported: ${supportedFileTypes.join(", ")}`,
		);
	}

	// Extract text preview for text-based files
	let textPreview = "";
	const textTypes = ["txt", "md", "json", "csv", "js", "ts", "py", "html", "css", "xml"];
	if (textTypes.includes(ext)) {
		try {
			const file = new FileSystem.File(attachment.uri);
			if (file.exists) {
				const content = file.text();
				textPreview = content.slice(0, FILE_PREVIEW_CHARS);
			}
		} catch {
			// Ignore read errors — alt text will be metadata-only
		}
	}

	const processed: ProcessedAttachment = {
		id: attachment.id,
		type: "file",
		uri: attachment.uri,
		mimeType: attachment.mimeType,
		fileName: attachment.fileName,
		fileSize: attachment.fileSize,
		width: 0,
		height: 0,
		duration: 0,
		alt: "",
		thumbnailUri: "",
	};

	// Generate alt text with optional text preview
	let alt = generateAltText(processed);
	if (textPreview) {
		alt += ` — Preview: ${textPreview}`;
	}
	processed.alt = alt;

	return processed;
}

/**
 * Default media pre-processing pipeline.
 * Processes all pending attachments according to provider capabilities.
 * Providers can override this by implementing preprocessMedia().
 */
export async function defaultPreprocessMedia(
	attachments: PendingAttachment[],
	capabilities: MultimodalCapabilities,
): Promise<ProcessedAttachment[]> {
	const results: ProcessedAttachment[] = [];

	for (const attachment of attachments) {
		switch (attachment.type) {
			case "image":
				results.push(await preprocessImage(attachment, capabilities));
				break;
			case "audio":
				results.push(await preprocessAudio(attachment, capabilities));
				break;
			case "file":
				results.push(await preprocessFile(attachment, capabilities));
				break;
		}
	}

	return results;
}
