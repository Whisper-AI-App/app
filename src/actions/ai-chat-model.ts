import * as Device from "expo-device";
import * as FileSystem from "expo-file-system";
import {
	createDownloadResumable,
	type DownloadResumable,
} from "expo-file-system/legacy";
import {
	getLatestConfig,
	recommendModelCard,
	type WhisperLLMCard,
	type WhisperLLMCardsJSON,
	whisperLLMCardsJson,
} from "whisper-llm-cards";
import { store } from "../store";
import { bytesToGB } from "../utils/bytes";
import {
	generateModelFileName,
	validateModelFileName,
} from "../utils/generate-model-filename";

// Default fallback model from bundled config
export const DEFAULT_AI_CHAT_MODEL: WhisperLLMCard =
	whisperLLMCardsJson.cards[whisperLLMCardsJson.defaultRecommendedCard];

// Keep a reference to the active download
let activeDownloadResumable: DownloadResumable | null = null;

/**
 * Fetches the latest recommended model configuration
 * @returns Promise with config and recommended card
 */
export async function fetchLatestRecommendedModel(): Promise<{
	config: WhisperLLMCardsJSON;
	recommendedCard: WhisperLLMCard;
	cardId: string;
}> {
	try {
		const config = await getLatestConfig();

		// Get device RAM in GB for model recommendation
		const deviceMemoryBytes = Device.totalMemory;
		const ramGB = deviceMemoryBytes ? bytesToGB(deviceMemoryBytes) : undefined;

		console.info(`Device RAM GB: ${ramGB}`);

		const cardId = recommendModelCard(ramGB);
		const recommendedCard = config.cards[cardId];

		console.info(`Recommended card ID: ${cardId}`);

		if (!recommendedCard) {
			throw new Error(
				`Recommended card "${cardId}" not found in configuration`,
			);
		}

		return { config, recommendedCard, cardId };
	} catch (error) {
		console.error("[AI Model] Failed to fetch latest config:", error);
		// Fallback to bundled config
		return {
			config: whisperLLMCardsJson,
			recommendedCard: DEFAULT_AI_CHAT_MODEL,
			cardId: whisperLLMCardsJson.recommendedCard,
		};
	}
}

/**
 * Updates the stored model card metadata without downloading
 * Use this when only metadata has changed (same sourceUrl)
 */
export function updateModelCard(
	card: WhisperLLMCard,
	cardId: string,
	configVersion: string,
): void {
	store.setValue("ai_chat_model_card", JSON.stringify(card));
	store.setValue("ai_chat_model_cardId", cardId);
	store.setValue("ai_chat_model_config_version", configVersion);
}

/**
 * Gets the currently stored model card
 * @returns The stored card or null if not found
 */
export function getStoredModelCard(): WhisperLLMCard | null {
	const cardJson = store.getValue("ai_chat_model_card") as string | undefined;
	if (!cardJson) return null;

	try {
		return JSON.parse(cardJson) as WhisperLLMCard;
	} catch (error) {
		console.error("[AI Model] Failed to parse stored card:", error);
		return null;
	}
}

/**
 * Compares two model cards for equality
 * Performs a deep comparison of all fields
 */
export function areCardsEqual(
	card1: WhisperLLMCard | null,
	card2: WhisperLLMCard,
): boolean {
	if (!card1) return false;

	// Deep equality check using JSON comparison
	// This automatically handles all fields, including any newly added ones
	return JSON.stringify(card1) === JSON.stringify(card2);
}

export interface ModelUpdateInfo {
	hasUpdate: boolean;
	currentCard: WhisperLLMCard | null;
	newCard: WhisperLLMCard;
	currentVersion: string | null;
	newVersion: string;
	requiresDownload: boolean;
	reason?: "version_mismatch" | "metadata_changed" | "filename_invalid";
}

/**
 * Checks if a model update is available
 * @returns Update information including whether download is required
 */
export async function checkForModelUpdates(): Promise<ModelUpdateInfo> {
	const storedConfigVersion = store.getValue("ai_chat_model_config_version") as
		| string
		| undefined;
	// Use filename instead of full path (path changes between app updates)
	const filename = store.getValue("ai_chat_model_filename") as
		| string
		| undefined;

	// Fetch latest recommended model
	const { config, recommendedCard, cardId } =
		await fetchLatestRecommendedModel();

	const currentCard = getStoredModelCard();
	const currentVersion = storedConfigVersion || null;
	const newVersion = config.version;

	// Check if filename matches expected version/hash
	let filenameValid = false;
	if (filename && currentCard && storedConfigVersion) {
		filenameValid = validateModelFileName(
			filename,
			currentCard,
			storedConfigVersion,
		);
		console.log("[checkForModelUpdates] Filename validation:", {
			filename,
			isValid: filenameValid,
		});
	}

	// If filename doesn't match, treat as version mismatch (force update)
	if (filename && !filenameValid && currentCard) {
		console.log(
			"[checkForModelUpdates] Filename mismatch detected - treating as outdated",
		);
		return {
			hasUpdate: true,
			currentCard,
			newCard: recommendedCard,
			currentVersion,
			newVersion,
			requiresDownload: true,
			reason: "filename_invalid",
		};
	}

	// Check version mismatch
	const versionsMatch = currentVersion === newVersion;

	if (!versionsMatch) {
		console.log("[checkForModelUpdates] Version mismatch:", {
			currentVersion,
			newVersion,
		});
	}

	// Check if cards are identical (using deep comparison)
	const cardsMatch = areCardsEqual(currentCard, recommendedCard);

	if (!cardsMatch) {
		console.log("[checkForModelUpdates] Card metadata differs:", {
			currentCard,
			recommendedCard,
		});
	}

	// No update needed if versions match AND cards match AND filename is valid (or no file yet)
	if (versionsMatch && cardsMatch && (filenameValid || !filename)) {
		console.log(
			"[checkForModelUpdates] No update available, versions and metadata match",
		);
		return {
			hasUpdate: false,
			currentCard,
			newCard: recommendedCard,
			currentVersion,
			newVersion,
			requiresDownload: false,
		};
	}

	// Determine if download is required
	// Download needed if:
	// 1. sourceUrl changed (different model file)
	// 2. Filename is invalid (file is outdated/corrupted)
	const requiresDownload =
		currentCard?.sourceUrl !== recommendedCard.sourceUrl || !filenameValid;

	console.log("[checkForModelUpdates] Update needed:", {
		requiresDownload,
		reason: !versionsMatch
			? "version_mismatch"
			: !cardsMatch
				? "metadata_changed"
				: "filename_invalid",
	});

	// If metadata-only update (no download required), update card immediately
	if (!requiresDownload) {
		updateModelCard(recommendedCard, cardId, newVersion);
		console.log(
			"[checkForModelUpdates] Metadata-only update - card updated to version",
			newVersion,
		);
	}

	return {
		hasUpdate: true,
		currentCard,
		newCard: recommendedCard,
		currentVersion,
		newVersion,
		requiresDownload,
		reason: !versionsMatch
			? "version_mismatch"
			: !cardsMatch
				? "metadata_changed"
				: "filename_invalid",
	};
}

/**
 * Creates a progress callback for download operations
 */
function createProgressCallback() {
	return (progressData: {
		totalBytesWritten: number;
		totalBytesExpectedToWrite: number;
	}) => {
		const progressSizeGB = bytesToGB(progressData.totalBytesWritten);
		store.setValue("ai_chat_model_progressSizeGB", progressSizeGB);
	};
}

/**
 * Checks if the download was paused by the user
 */
function checkIfPaused(): boolean {
	return store.getValue("ai_chat_model_isPaused") as boolean;
}

/**
 * Cleans up download state in the store
 */
function cleanupDownloadState(): void {
	store.delValue("ai_chat_model_downloadError");
	store.delValue("ai_chat_model_resumableState");
	store.delValue("ai_chat_model_isPaused");
}

/**
 * Handles successful download completion
 */
function handleDownloadComplete(result: { status: number } | null): void {
	if (result?.status === 200 || result?.status === 206) {
		store.setValue("ai_chat_model_downloadedAt", new Date().toISOString());
		cleanupDownloadState();
		activeDownloadResumable = null;
	} else {
		throw new Error(`Download failed with status: ${result?.status}`);
	}
}

/**
 * Handles download errors, distinguishing between pauses and real errors
 */
function handleDownloadError(error: unknown): void {
	if (checkIfPaused()) {
		return; // Exit gracefully, not a real error
	}

	console.error("[AI Model Download] Error occurred", error);
	const errorMessage =
		error instanceof Error ? error.message : "Unknown error occurred";
	store.setValue("ai_chat_model_downloadError", errorMessage);
	store.setValue("ai_chat_model_isPaused", true); // Mark as paused so user can retry
	activeDownloadResumable = null;
	throw error;
}

/**
 * Pauses the current download
 */
export async function pauseDownload(): Promise<void> {
	if (!activeDownloadResumable) {
		return;
	}

	try {
		await activeDownloadResumable.pauseAsync();
		const savable = activeDownloadResumable.savable();

		store.setValue("ai_chat_model_resumableState", JSON.stringify(savable));
		store.setValue("ai_chat_model_isPaused", true);
	} catch (error) {
		console.error("[AI Model Download] Error pausing download", error);
		throw error;
	}
}

/**
 * Resumes a paused download
 */
export async function resumeDownload(): Promise<void> {
	const resumableStateStr = store.getValue("ai_chat_model_resumableState");

	if (!resumableStateStr) {
		return;
	}

	try {
		const resumableState = JSON.parse(resumableStateStr as string);
		const fileUri = store.getValue("ai_chat_model_fileUri") as string;

		const resumable = createDownloadResumable(
			resumableState.url,
			fileUri,
			resumableState.options,
			createProgressCallback(),
			resumableState.resumeData,
		);

		activeDownloadResumable = resumable;
		store.setValue("ai_chat_model_isPaused", false);

		const result = await resumable.downloadAsync();

		if (checkIfPaused()) {
			return;
		}

		handleDownloadComplete(result);
	} catch (error) {
		handleDownloadError(error);
	}
}

/**
 * Starts or resumes downloading an AI chat model.
 */
export async function startOrResumeDownloadOfAIChatModel(
	card: WhisperLLMCard,
	cardId: string,
	configVersion: string,
	restart: boolean = false,
): Promise<void> {
	const sourceUrl = card.sourceUrl;
	const isPaused = store.getValue("ai_chat_model_isPaused") as
		| boolean
		| undefined;
	const resumableStateStr = store.getValue("ai_chat_model_resumableState");

	if (isPaused && resumableStateStr && !restart) {
		return resumeDownload();
	}

	// Generate versioned filename with hash
	const versionedFilename = generateModelFileName(card, configVersion);
	// Store only filename, not full path (path changes between app updates)
	const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${versionedFilename}`;

	const existingFilename = store.getValue("ai_chat_model_filename") as
		| string
		| undefined;
	// Also check legacy fileUri for migration
	const existingFileUri = store.getValue("ai_chat_model_fileUri");
	const downloadedAt = store.getValue("ai_chat_model_downloadedAt");

	// Check if already downloaded (by filename, not full path which changes between updates)
	if (
		existingFilename &&
		downloadedAt &&
		existingFilename === versionedFilename
	) {
		return;
	}
	// Legacy check for migration from old fileUri storage
	if (
		!existingFilename &&
		existingFileUri &&
		downloadedAt &&
		existingFileUri === fileUri
	) {
		return;
	}

	if (restart) {
		const file = new FileSystem.File(fileUri);
		if (file.exists) {
			await file.delete();
		}
		store.setValue("ai_chat_model_progressSizeGB", 0);
		cleanupDownloadState();
	}

	// Save card metadata
	store.setValue("ai_chat_model_card", JSON.stringify(card));
	store.setValue("ai_chat_model_cardId", cardId);
	store.setValue("ai_chat_model_config_version", configVersion);
	// Store filename instead of full path (path changes between app updates)
	store.setValue("ai_chat_model_filename", versionedFilename);
	// Keep fileUri for backward compatibility during transition
	store.setValue("ai_chat_model_fileUri", fileUri);
	store.delValue("ai_chat_model_downloadedAt");
	store.delValue("ai_chat_model_downloadError");
	store.setValue("ai_chat_model_isPaused", false);

	if (!store.getValue("ai_chat_model_progressSizeGB")) {
		store.setValue("ai_chat_model_progressSizeGB", 0);
	}

	try {
		const resumable = createDownloadResumable(
			sourceUrl,
			fileUri,
			{},
			createProgressCallback(),
		);

		activeDownloadResumable = resumable;

		const result = await resumable.downloadAsync();

		if (checkIfPaused()) {
			return;
		}

		handleDownloadComplete(result);
	} catch (error) {
		handleDownloadError(error);
	}
}
