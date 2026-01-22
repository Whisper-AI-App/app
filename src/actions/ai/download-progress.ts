import { mainStore } from "../../stores/main/main-store";
import { bytesToGB } from "../../utils/bytes";
import { setActiveDownloadResumable } from "./state";

/**
 * Creates a throttled progress callback for download operations
 * Only updates store at most once per 500ms to avoid flooding the JS thread
 */
export function createProgressCallback() {
	let lastUpdateTime = 0;
	let pendingProgress: number | null = null;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return (progressData: {
		totalBytesWritten: number;
		totalBytesExpectedToWrite: number;
	}) => {
		const progressSizeGB = bytesToGB(progressData.totalBytesWritten);
		const now = Date.now();

		// If enough time has passed, update immediately
		if (now - lastUpdateTime >= 500) {
			lastUpdateTime = now;
			mainStore.setValue("ai_chat_model_progressSizeGB", progressSizeGB);
			pendingProgress = null;
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		} else {
			// Otherwise, store the latest progress and schedule an update
			pendingProgress = progressSizeGB;
			if (!timeoutId) {
				timeoutId = setTimeout(() => {
					if (pendingProgress !== null) {
						mainStore.setValue("ai_chat_model_progressSizeGB", pendingProgress);
						lastUpdateTime = Date.now();
						pendingProgress = null;
					}
					timeoutId = null;
				}, 500 - (now - lastUpdateTime));
			}
		}
	};
}

/**
 * Checks if the download was paused by the user
 */
export function checkIfPaused(): boolean {
	return mainStore.getValue("ai_chat_model_isPaused") as boolean;
}

/**
 * Cleans up download state in the store
 */
export function cleanupDownloadState(): void {
	mainStore.delValue("ai_chat_model_downloadError");
	mainStore.delValue("ai_chat_model_resumableState");
	mainStore.delValue("ai_chat_model_isPaused");
}

/**
 * Handles successful download completion
 */
export function handleDownloadComplete(result: { status: number } | null): void {
	if (result?.status === 200 || result?.status === 206) {
		mainStore.setValue("ai_chat_model_downloadedAt", new Date().toISOString());
		cleanupDownloadState();
		setActiveDownloadResumable(null);
	} else {
		throw new Error(`Download failed with status: ${result?.status}`);
	}
}

/**
 * Handles download errors, distinguishing between pauses and real errors
 */
export function handleDownloadError(error: unknown): void {
	if (checkIfPaused()) {
		return; // Exit gracefully, not a real error
	}

	console.error("[AI Model Download] Error occurred", error);
	const errorMessage =
		error instanceof Error ? error.message : "Unknown error occurred";
	mainStore.setValue("ai_chat_model_downloadError", errorMessage);
	mainStore.setValue("ai_chat_model_isPaused", true); // Mark as paused so user can retry
	setActiveDownloadResumable(null);
	throw error;
}
