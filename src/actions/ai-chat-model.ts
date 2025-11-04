import * as FileSystem from "expo-file-system";
import {
	createDownloadResumable,
	type DownloadResumable,
} from "expo-file-system/legacy";
import { store } from "../store";

export const DEFAULT_AI_CHAT_MODEL = {
	name: "Qwen3 0.6B Q4_0",
	sourceUrl:
		"https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/main/Qwen3-0.6B-Q4_0.gguf",
};

// Keep a reference to the active download
let activeDownloadResumable: DownloadResumable | null = null;

/**
 * Extracts a safe model name from a URL.
 * Example: "https://huggingface.co/.../Qwen3-4B-Q4_0.gguf" => "Qwen3-4B-Q4_0"
 */
function extractModelNameFromUrl(url: string): string {
	try {
		const urlParts = url.split("/");
		const filename = urlParts[urlParts.length - 1];
		// Remove .gguf extension and sanitize
		const modelName = filename.replace(/\.gguf$/i, "");
		// Replace any non-alphanumeric characters (except hyphens and underscores) with underscores
		return modelName.replace(/[^a-zA-Z0-9_-]/g, "_");
	} catch (error) {
		// Fallback to timestamp-based name
		return `model_${Date.now()}`;
	}
}

/**
 * Converts bytes to GB
 */
function bytesToGB(bytes: number): number {
	return bytes / (1024 * 1024 * 1024);
}

/**
 * Pauses the current download
 */
export async function pauseDownload(): Promise<void> {
	if (!activeDownloadResumable) {
		console.warn("[AI Model Download] No active download to pause");
		return;
	}

	console.log("[AI Model Download] Pausing download");

	try {
		await activeDownloadResumable.pauseAsync();
		const savable = activeDownloadResumable.savable();

		// Save resumable state to store
		store.setValue("ai_chat_model_resumableState", JSON.stringify(savable));
		store.setValue("ai_chat_model_isPaused", true);

		console.log("[AI Model Download] Download paused successfully");
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
		console.warn("[AI Model Download] No resumable state found");
		return;
	}

	console.log("[AI Model Download] Resuming download from saved state");

	try {
		const resumableState = JSON.parse(resumableStateStr as string);
		const fileUri = store.getValue("ai_chat_model_fileUri") as string;

		// Create resumable from saved state
		const resumable = createDownloadResumable(
			resumableState.url,
			fileUri,
			resumableState.options,
			(progressData) => {
				const totalSizeGB = bytesToGB(progressData.totalBytesExpectedToWrite);
				const progressSizeGB = bytesToGB(progressData.totalBytesWritten);

				console.log("[AI Model Download] Progress update", {
					totalBytesWritten: progressData.totalBytesWritten,
					totalBytesExpectedToWrite: progressData.totalBytesExpectedToWrite,
					totalSizeGB: totalSizeGB.toFixed(2),
					progressSizeGB: progressSizeGB.toFixed(2),
					progressPercent: `${((progressSizeGB / totalSizeGB) * 100).toFixed(2)}%`,
				});

				store.setValue("ai_chat_model_totalSizeGB", totalSizeGB);
				store.setValue("ai_chat_model_progressSizeGB", progressSizeGB);
			},
			resumableState.resumeData,
		);

		activeDownloadResumable = resumable;
		store.setValue("ai_chat_model_isPaused", false);

		console.log("[AI Model Download] Starting resumed download...");
		const result = await resumable.downloadAsync();

		console.log("[AI Model Download] Download completed", {
			status: result?.status,
			uri: result?.uri,
		});

		// Check if download was paused (not an error, just paused by user)
		const isPausedNow = store.getValue("ai_chat_model_isPaused");
		if (isPausedNow) {
			console.log("[AI Model Download] Download was paused by user");
			return; // Exit gracefully, state already saved by pauseDownload()
		}

		if (result?.status === 200 || result?.status === 206) {
			console.log("[AI Model Download] Marking as completed in store");
			store.setValue("ai_chat_model_downloadedAt", new Date().toISOString());
			store.delValue("ai_chat_model_downloadError");
			store.delValue("ai_chat_model_resumableState");
			store.delValue("ai_chat_model_isPaused");
			activeDownloadResumable = null;
			console.log("[AI Model Download] Successfully completed download");
		} else {
			throw new Error(`Download failed with status: ${result?.status}`);
		}
	} catch (error) {
		// Check if this was a pause (not a real error)
		const isPausedNow = store.getValue("ai_chat_model_isPaused");
		if (isPausedNow) {
			console.log("[AI Model Download] Download was paused, not an error");
			return; // Exit gracefully
		}

		console.error("[AI Model Download] Error resuming download", error);
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
		store.setValue("ai_chat_model_downloadError", errorMessage);
		activeDownloadResumable = null;
		throw error;
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
	console.log("[AI Model Download] Starting download process", {
		sourceUrl,
		modelName,
		restart,
	});

	// Check if there's a paused download that can be resumed
	const isPaused = store.getValue("ai_chat_model_isPaused") as
		| boolean
		| undefined;
	const resumableStateStr = store.getValue("ai_chat_model_resumableState");

	if (isPaused && resumableStateStr && !restart) {
		console.log("[AI Model Download] Found paused download, resuming...");
		return resumeDownload();
	}

	// Extract or use provided model name
	const safeName = modelName || extractModelNameFromUrl(sourceUrl);
	const cleanGgufFilename = `${safeName}.gguf`;
	const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${cleanGgufFilename}`;

	console.log("[AI Model Download] File details", {
		safeName,
		cleanGgufFilename,
		fileUri,
	});

	// Check if model already exists and is fully downloaded
	const existingFileUri = store.getValue("ai_chat_model_fileUri");
	const downloadedAt = store.getValue("ai_chat_model_downloadedAt");

	console.log("[AI Model Download] Existing model check", {
		existingFileUri,
		downloadedAt,
	});

	if (existingFileUri && downloadedAt && existingFileUri === fileUri) {
		console.log("[AI Model Download] Model already fully downloaded");
		return;
	}

	// Handle restart: delete file and reset progress
	if (restart) {
		console.log("[AI Model Download] Restarting download, deleting file");
		const file = new FileSystem.File(fileUri);
		if (file.exists) {
			await file.delete();
			console.log("[AI Model Download] Deleted existing file");
		}
		store.setValue("ai_chat_model_progressSizeGB", 0);
		store.delValue("ai_chat_model_downloadError");
		store.delValue("ai_chat_model_resumableState");
		store.delValue("ai_chat_model_isPaused");
		console.log("[AI Model Download] Reset progress in store");
	}

	// Initialize store values
	console.log("[AI Model Download] Setting initial values in store");
	store.setValue("ai_chat_model_sourceUrl", sourceUrl);
	store.setValue("ai_chat_model_fileUri", fileUri);
	store.delValue("ai_chat_model_downloadedAt");
	store.delValue("ai_chat_model_downloadError");
	store.setValue("ai_chat_model_isPaused", false);

	if (!store.getValue("ai_chat_model_progressSizeGB")) {
		store.setValue("ai_chat_model_progressSizeGB", 0);
	}

	try {
		console.log("[AI Model Download] Creating download resumable");
		// Create resumable download
		const resumable = createDownloadResumable(
			sourceUrl,
			fileUri,
			{},
			(progressData) => {
				const totalSizeGB = bytesToGB(progressData.totalBytesExpectedToWrite);
				const progressSizeGB = bytesToGB(progressData.totalBytesWritten);

				console.log("[AI Model Download] Progress update", {
					totalBytesWritten: progressData.totalBytesWritten,
					totalBytesExpectedToWrite: progressData.totalBytesExpectedToWrite,
					totalSizeGB: totalSizeGB.toFixed(2),
					progressSizeGB: progressSizeGB.toFixed(2),
					progressPercent: `${((progressSizeGB / totalSizeGB) * 100).toFixed(2)}%`,
				});

				store.setValue("ai_chat_model_totalSizeGB", totalSizeGB);
				store.setValue("ai_chat_model_progressSizeGB", progressSizeGB);
			},
		);

		activeDownloadResumable = resumable;

		console.log("[AI Model Download] Starting download async...");

		// Start download
		const result = await resumable.downloadAsync();

		console.log("[AI Model Download] Download completed", {
			status: result?.status,
			uri: result?.uri,
		});

		// Check if download was paused (not an error, just paused by user)
		const isPausedNow = store.getValue("ai_chat_model_isPaused");
		if (isPausedNow) {
			console.log("[AI Model Download] Download was paused by user");
			return; // Exit gracefully, state already saved by pauseDownload()
		}

		if (result?.status === 200 || result?.status === 206) {
			console.log("[AI Model Download] Marking as completed in store");
			// Mark as completed
			store.setValue("ai_chat_model_downloadedAt", new Date().toISOString());
			store.delValue("ai_chat_model_downloadError");
			store.delValue("ai_chat_model_resumableState");
			store.delValue("ai_chat_model_isPaused");
			activeDownloadResumable = null;
			console.log("[AI Model Download] Successfully completed download");
		} else {
			throw new Error(`Download failed with status: ${result?.status}`);
		}
	} catch (error) {
		// Check if this was a pause (not a real error)
		const isPausedNow = store.getValue("ai_chat_model_isPaused");
		if (isPausedNow) {
			console.log("[AI Model Download] Download was paused, not an error");
			return; // Exit gracefully
		}

		console.error("[AI Model Download] Error occurred", error);
		// Save error to store
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
		store.setValue("ai_chat_model_downloadError", errorMessage);
		activeDownloadResumable = null;
		console.log("[AI Model Download] Error saved to store", errorMessage);
		throw error;
	}
}
