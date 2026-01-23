import * as FileSystem from "expo-file-system";
import { createDownloadResumable } from "expo-file-system/legacy";
import type { WhisperLLMCard } from "whisper-llm-cards";
import { mainStore } from "../../stores/main/main-store";
import { generateModelFileName } from "../../utils/generate-model-filename";
import {
	checkIfPaused,
	cleanupDownloadState,
	createProgressCallback,
	handleDownloadComplete,
	handleDownloadError,
} from "./download-progress";
import { getActiveDownloadResumable, setActiveDownloadResumable } from "./state";

/**
 * Pauses the current download
 */
export async function pauseDownload(): Promise<void> {
	const activeDownloadResumable = getActiveDownloadResumable();
	if (!activeDownloadResumable) {
		return;
	}

	try {
		await activeDownloadResumable.pauseAsync();
		const savable = activeDownloadResumable.savable();

		mainStore.setValue("ai_chat_model_resumableState", JSON.stringify(savable));
		mainStore.setValue("ai_chat_model_isPaused", true);
	} catch (error) {
		console.error("[AI Model Download] Error pausing download", error);
		throw error;
	}
}

/**
 * Resumes a paused download
 */
export async function resumeDownload(): Promise<void> {
	const resumableStateStr = mainStore.getValue("ai_chat_model_resumableState");

	if (!resumableStateStr) {
		return;
	}

	try {
		const resumableState = JSON.parse(resumableStateStr as string);
		const fileUri = mainStore.getValue("ai_chat_model_fileUri") as string;

		const resumable = createDownloadResumable(
			resumableState.url,
			fileUri,
			resumableState.options,
			createProgressCallback(),
			resumableState.resumeData,
		);

		setActiveDownloadResumable(resumable);
		mainStore.setValue("ai_chat_model_isPaused", false);

		const result = await resumable.downloadAsync();

		if (checkIfPaused()) {
			return;
		}

		handleDownloadComplete(result ?? null);
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
	const isPaused = mainStore.getValue("ai_chat_model_isPaused") as
		| boolean
		| undefined;
	const resumableStateStr = mainStore.getValue("ai_chat_model_resumableState");

	if (isPaused && resumableStateStr && !restart) {
		return resumeDownload();
	}

	// Generate versioned filename with hash
	const versionedFilename = generateModelFileName(card, configVersion);
	// Store only filename, not full path (path changes between app updates)
	const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${versionedFilename}`;

	const existingFilename = mainStore.getValue("ai_chat_model_filename") as
		| string
		| undefined;
	// Also check legacy fileUri for migration
	const existingFileUri = mainStore.getValue("ai_chat_model_fileUri");
	const downloadedAt = mainStore.getValue("ai_chat_model_downloadedAt");

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
		mainStore.setValue("ai_chat_model_progressSizeGB", 0);
		cleanupDownloadState();
	}

	// Save card metadata
	mainStore.setValue("ai_chat_model_card", JSON.stringify(card));
	mainStore.setValue("ai_chat_model_cardId", cardId);
	mainStore.setValue("ai_chat_model_config_version", configVersion);
	// Store filename instead of full path (path changes between app updates)
	mainStore.setValue("ai_chat_model_filename", versionedFilename);
	// Keep fileUri for backward compatibility during transition
	mainStore.setValue("ai_chat_model_fileUri", fileUri);
	mainStore.delValue("ai_chat_model_downloadedAt");
	mainStore.delValue("ai_chat_model_downloadError");
	mainStore.setValue("ai_chat_model_isPaused", false);

	if (!mainStore.getValue("ai_chat_model_progressSizeGB")) {
		mainStore.setValue("ai_chat_model_progressSizeGB", 0);
	}

	try {
		const resumable = createDownloadResumable(
			sourceUrl,
			fileUri,
			{},
			createProgressCallback(),
		);

		setActiveDownloadResumable(resumable);

		const result = await resumable.downloadAsync();

		if (checkIfPaused()) {
			return;
		}

		handleDownloadComplete(result ?? null);
	} catch (error) {
		handleDownloadError(error);
	}
}
