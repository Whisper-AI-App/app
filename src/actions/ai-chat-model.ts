import * as FileSystem from "expo-file-system";
import {
	createDownloadResumable,
	type DownloadResumable,
} from "expo-file-system/legacy";
import { store } from "../store";
import { bytesToGB } from "../utils/bytes";
import { extractLLMModelNameFromUrl } from "../utils/extract-llm-model-name-from-url";

export const DEFAULT_AI_CHAT_MODEL = {
	name: "Llama 3.2 1B Instruct Q4_0",
	sourceUrl:
		"https://huggingface.co/unsloth/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_0.gguf",
};

// Keep a reference to the active download
let activeDownloadResumable: DownloadResumable | null = null;

/**
 * Creates a progress callback for download operations
 */
function createProgressCallback() {
	return (progressData: {
		totalBytesWritten: number;
		totalBytesExpectedToWrite: number;
	}) => {
		const totalSizeGB = bytesToGB(progressData.totalBytesExpectedToWrite);
		const progressSizeGB = bytesToGB(progressData.totalBytesWritten);

		store.setValue("ai_chat_model_totalSizeGB", totalSizeGB);
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
	sourceUrl: string,
	modelName?: string,
	restart: boolean = false,
): Promise<void> {
	const isPaused = store.getValue("ai_chat_model_isPaused") as
		| boolean
		| undefined;
	const resumableStateStr = store.getValue("ai_chat_model_resumableState");

	if (isPaused && resumableStateStr && !restart) {
		return resumeDownload();
	}

	const safeName = modelName || extractLLMModelNameFromUrl(sourceUrl);
	const cleanGgufFilename = `${safeName}.gguf`;
	const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${cleanGgufFilename}`;

	const existingFileUri = store.getValue("ai_chat_model_fileUri");
	const downloadedAt = store.getValue("ai_chat_model_downloadedAt");

	if (existingFileUri && downloadedAt && existingFileUri === fileUri) {
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

	store.setValue("ai_chat_model_sourceUrl", sourceUrl);
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
