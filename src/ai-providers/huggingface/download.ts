import * as FileSystem from "expo-file-system";
import {
	createDownloadResumable,
	type DownloadResumable,
} from "expo-file-system/legacy";
import type { Store } from "tinybase";
import { createLogger } from "@/src/logger";
import { getCredential } from "../../actions/secure-credentials";
import { bytesToGB } from "../../utils/bytes";
import { maybeProxyUrl } from "../../utils/dev-proxy";

const logger = createLogger("HuggingFace:Download");

const PROVIDER_ID = "huggingface";

// HuggingFace API token credential field
const HF_TOKEN_FIELD = "apiToken";

// Module-scoped download reference
let activeDownloadResumable: DownloadResumable | null = null;

export function getActiveDownloadResumable(): DownloadResumable | null {
	return activeDownloadResumable;
}

export function setActiveDownloadResumable(
	resumable: DownloadResumable | null,
): void {
	activeDownloadResumable = resumable;
}

// ==================== DOWNLOAD QUEUE MANAGEMENT ====================

type QueueItem = string; // model ID

/**
 * Gets the current download queue from the store
 */
export function getDownloadQueue(store: Store): QueueItem[] {
	const queueStr = store.getCell("aiProviders", PROVIDER_ID, "downloadQueue") as
		| string
		| undefined;
	if (!queueStr) return [];
	try {
		const parsed = JSON.parse(queueStr);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/**
 * Saves the queue to the store
 */
function setDownloadQueue(store: Store, queue: QueueItem[]): void {
	store.setCell(
		"aiProviders",
		PROVIDER_ID,
		"downloadQueue",
		JSON.stringify(queue),
	);
}

/**
 * Adds a model ID to the download queue
 * @returns true if added, false if already in queue
 */
export function addToDownloadQueue(store: Store, modelId: string): boolean {
	const queue = getDownloadQueue(store);
	if (queue.includes(modelId)) return false;
	setDownloadQueue(store, [...queue, modelId]);
	return true;
}

/**
 * Removes a model ID from the download queue
 * @returns true if removed, false if not in queue
 */
export function removeFromDownloadQueue(
	store: Store,
	modelId: string,
): boolean {
	const queue = getDownloadQueue(store);
	const index = queue.indexOf(modelId);
	if (index === -1) return false;
	const newQueue = [...queue];
	newQueue.splice(index, 1);
	setDownloadQueue(store, newQueue);
	return true;
}

/**
 * Checks if a download is currently active
 */
export function isDownloadActive(store: Store): boolean {
	const status = store.getCell("aiProviders", PROVIDER_ID, "status") as
		| string
		| undefined;
	return status === "downloading";
}

/**
 * Gets the next model ID from the queue
 */
export function getNextInQueue(store: Store): string | null {
	const queue = getDownloadQueue(store);
	return queue.length > 0 ? queue[0] : null;
}

/**
 * Checks if a model is currently queued
 */
export function isModelQueued(store: Store, modelId: string): boolean {
	return getDownloadQueue(store).includes(modelId);
}

/**
 * Starts the next download in the queue
 */
export async function startNextQueuedDownload(store: Store): Promise<void> {
	const nextModelId = getNextInQueue(store);
	if (!nextModelId) return;

	// Remove from queue before starting
	removeFromDownloadQueue(store, nextModelId);

	// Set as selected model and start download
	store.setCell("aiProviders", PROVIDER_ID, "selectedModelId", nextModelId);

	const filename = store.getCell(
		"hfModels",
		nextModelId,
		"localFilename",
	) as string;
	if (filename) {
		store.setCell("aiProviders", PROVIDER_ID, "filename", filename);
	}

	// Reset download state so the next model starts fresh
	// (previous download may have left isPaused=true on error)
	store.setCell("aiProviders", PROVIDER_ID, "isPaused", false);
	store.setCell("aiProviders", PROVIDER_ID, "resumableState", "");
	store.setCell("aiProviders", PROVIDER_ID, "downloadError", "");

	// Start the download
	await startDownload(store, false);
}

/**
 * Creates a throttled progress callback for download operations.
 * Only updates store at most once per 500ms.
 */
function createProgressCallback(store: Store) {
	let lastUpdateTime = 0;
	let pendingProgress: number | null = null;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return (progressData: {
		totalBytesWritten: number;
		totalBytesExpectedToWrite: number;
	}) => {
		const progressSizeGB = bytesToGB(progressData.totalBytesWritten);
		const now = Date.now();

		if (now - lastUpdateTime >= 500) {
			lastUpdateTime = now;
			store.setCell(
				"aiProviders",
				PROVIDER_ID,
				"progressSizeGB",
				progressSizeGB,
			);
			pendingProgress = null;
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		} else {
			pendingProgress = progressSizeGB;
			if (!timeoutId) {
				timeoutId = setTimeout(
					() => {
						if (pendingProgress !== null) {
							store.setCell(
								"aiProviders",
								PROVIDER_ID,
								"progressSizeGB",
								pendingProgress,
							);
							lastUpdateTime = Date.now();
							pendingProgress = null;
						}
						timeoutId = null;
					},
					500 - (now - lastUpdateTime),
				);
			}
		}
	};
}

function checkIfPaused(store: Store): boolean {
	return store.getCell("aiProviders", PROVIDER_ID, "isPaused") as boolean;
}

function cleanupDownloadState(store: Store): void {
	store.setCell("aiProviders", PROVIDER_ID, "downloadError", "");
	store.setCell("aiProviders", PROVIDER_ID, "resumableState", "");
	store.setCell("aiProviders", PROVIDER_ID, "isPaused", false);
}

/**
 * Downloads the mmproj (multimodal projection) file for a vision model.
 * This is called after the main model download completes.
 * Failure is non-fatal — the model works without vision.
 */
async function downloadMmproj(store: Store, modelId: string): Promise<void> {
	const mmprojDownloadUrl = store.getCell(
		"hfModels",
		modelId,
		"mmprojDownloadUrl",
	) as string | undefined;
	const mmprojFilename = store.getCell("hfModels", modelId, "mmprojFilename") as
		| string
		| undefined;

	if (!mmprojDownloadUrl || !mmprojFilename) return;

	// Generate local filename for mmproj
	const repoId = store.getCell("hfModels", modelId, "repoId") as string;
	const localMmprojFilename =
		`hf-${repoId.replace(/\//g, "-")}-${mmprojFilename}`
			.replace(/[^a-zA-Z0-9._-]/g, "-")
			.substring(0, 100);
	const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${localMmprojFilename}`;

	store.setCell(
		"hfModels",
		modelId,
		"mmprojLocalFilename",
		localMmprojFilename,
	);

	logger.info("Starting mmproj download", { filename: mmprojFilename });

	try {
		const downloadOptions = await getDownloadOptions();
		const resumable = createDownloadResumable(
			maybeProxyUrl(mmprojDownloadUrl),
			fileUri,
			downloadOptions,
			createProgressCallback(store),
		);

		const result = await resumable.downloadAsync();

		if (result?.status === 200 || result?.status === 206) {
			store.setCell(
				"hfModels",
				modelId,
				"mmprojDownloadedAt",
				new Date().toISOString(),
			);
			logger.info("mmproj download complete");
		} else {
			logger.warn("mmproj download failed with status", {
				status: result?.status,
			});
		}
	} catch (error) {
		logger.warn("mmproj download failed (non-fatal)", {
			error: error instanceof Error ? error.message : String(error),
		});
		// Non-fatal: model works without vision
	}
}

async function handleDownloadComplete(
	store: Store,
	result: { status: number } | null,
): Promise<void> {
	if (result?.status === 200 || result?.status === 206) {
		// Mark the hfModels row as downloaded
		const selectedModelId = store.getCell(
			"aiProviders",
			PROVIDER_ID,
			"selectedModelId",
		) as string;
		if (selectedModelId) {
			store.setCell(
				"hfModels",
				selectedModelId,
				"downloadedAt",
				new Date().toISOString(),
			);

			// Download mmproj for vision models (non-fatal on failure)
			const mmprojDownloadUrl = store.getCell(
				"hfModels",
				selectedModelId,
				"mmprojDownloadUrl",
			) as string | undefined;
			if (mmprojDownloadUrl) {
				await downloadMmproj(store, selectedModelId);
			}
		}

		store.setCell("aiProviders", PROVIDER_ID, "status", "ready");
		cleanupDownloadState(store);
		setActiveDownloadResumable(null);
		logger.info("Download complete");

		// Start next queued download asynchronously
		// Use setImmediate to ensure the current download state is fully cleaned up first
		setImmediate(() => {
			startNextQueuedDownload(store).catch((err) => {
				logger.error("Error starting next queued download", {
					error: err instanceof Error ? err.message : String(err),
				});
			});
		});
	} else {
		logger.error("Download failed with status", { status: result?.status });
		throw new Error(`Download failed with status: ${result?.status}`);
	}
}

function handleDownloadError(store: Store, error: unknown): void {
	if (checkIfPaused(store)) return;

	logger.error("Error occurred", {
		error: error instanceof Error ? error.message : String(error),
	});
	let errorMessage =
		error instanceof Error ? error.message : "Unknown error occurred";

	// Provide helpful message for 401 errors
	if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
		errorMessage =
			"Authentication failed. Please add or update your HuggingFace token for this gated model.";
	}

	store.setCell("aiProviders", PROVIDER_ID, "downloadError", errorMessage);
	store.setCell("aiProviders", PROVIDER_ID, "isPaused", true);
	setActiveDownloadResumable(null);

	// Start next queued download even on error
	setImmediate(() => {
		startNextQueuedDownload(store).catch((err) => {
			logger.error("Error starting next queued download", {
				error: err instanceof Error ? err.message : String(err),
			});
		});
	});

	throw error;
}

/**
 * Pauses the current download.
 */
export async function pauseDownload(store: Store): Promise<void> {
	// Store a local reference to avoid race conditions with callbacks
	// that might set activeDownloadResumable to null
	const resumable = activeDownloadResumable;
	if (!resumable) return;

	try {
		await resumable.pauseAsync();

		// Get the savable state - now using local reference
		const savable = resumable.savable();

		if (savable) {
			store.setCell(
				"aiProviders",
				PROVIDER_ID,
				"resumableState",
				JSON.stringify(savable),
			);
			store.setCell("aiProviders", PROVIDER_ID, "isPaused", true);
		} else {
			logger.warn("savable() returned null after pauseAsync");
			store.setCell("aiProviders", PROVIDER_ID, "isPaused", true);
		}

		// Clear the module-level reference AFTER all operations are complete
		setActiveDownloadResumable(null);
	} catch (error) {
		logger.error("Error pausing download", {
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

/**
 * Resumes a paused download. If no resumable state exists (e.g., after an error),
 * restarts the download from scratch.
 */
export async function resumeDownload(store: Store): Promise<void> {
	const resumableStateStr = store.getCell(
		"aiProviders",
		PROVIDER_ID,
		"resumableState",
	) as string | undefined;

	// If there's no resumable state (e.g., download failed immediately), restart from scratch
	if (!resumableStateStr) {
		logger.info("No resumable state, restarting download");
		await startDownload(store, true);
		return;
	}

	try {
		const resumableState = JSON.parse(resumableStateStr);
		const filename = store.getCell(
			"aiProviders",
			PROVIDER_ID,
			"filename",
		) as string;
		const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${filename}`;

		// Get fresh download options with current authentication
		const downloadOptions = await getDownloadOptions();

		// Merge the saved options with fresh authentication headers
		const savedOptions =
			(resumableState.options as Record<string, unknown>) ?? {};
		const savedHeaders = (savedOptions.headers as Record<string, string>) ?? {};
		const freshHeaders =
			(downloadOptions.headers as Record<string, string>) ?? {};

		const mergedOptions = {
			...savedOptions,
			...downloadOptions,
			headers: {
				...savedHeaders,
				...freshHeaders,
			},
		};

		const resumable = createDownloadResumable(
			resumableState.url,
			fileUri,
			mergedOptions,
			createProgressCallback(store),
			resumableState.resumeData,
		);

		setActiveDownloadResumable(resumable);
		store.setCell("aiProviders", PROVIDER_ID, "isPaused", false);

		const result = await resumable.downloadAsync();

		if (checkIfPaused(store)) return;
		await handleDownloadComplete(store, result ?? null);
	} catch (error) {
		handleDownloadError(store, error);
	}
}

/**
 * Gets the download options with HF token authentication if available.
 */
async function getDownloadOptions(): Promise<Record<string, unknown>> {
	const token = await getCredential(PROVIDER_ID, HF_TOKEN_FIELD);

	if (!token) {
		// No token stored, return default options
		return {};
	}

	// Return options with Authorization header
	return {
		headers: {
			Authorization: `Bearer ${token}`,
		},
	};
}

/**
 * Starts or resumes downloading the currently selected HF model.
 * If a download is already active and restart is false, adds to queue instead.
 *
 * @returns true if download started, false if added to queue
 */
export async function startDownload(
	store: Store,
	restart = false,
): Promise<boolean> {
	const selectedModelId = store.getCell(
		"aiProviders",
		PROVIDER_ID,
		"selectedModelId",
	) as string;
	if (!selectedModelId) {
		throw new Error("No model selected for download");
	}

	const modelRow = store.getRow("hfModels", selectedModelId);
	if (!modelRow) {
		throw new Error(`Model not found: ${selectedModelId}`);
	}

	const downloadUrl = modelRow.downloadUrl as string;
	const localFilename = modelRow.localFilename as string;
	const fileSizeBytes = modelRow.fileSizeBytes as number;
	const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${localFilename}`;

	const isPaused = store.getCell(
		"aiProviders",
		PROVIDER_ID,
		"isPaused",
	) as boolean;
	const resumableStateStr = store.getCell(
		"aiProviders",
		PROVIDER_ID,
		"resumableState",
	) as string | undefined;

	// Resume if paused and not restarting
	if (isPaused && resumableStateStr && !restart) {
		await resumeDownload(store);
		return true;
	}

	// Check if already downloaded
	const downloadedAt = store.getCell(
		"hfModels",
		selectedModelId,
		"downloadedAt",
	) as string | undefined;
	if (downloadedAt && !restart) return false;

	// Check if a download is already active - if so, add to queue
	if (isDownloadActive(store) && !restart) {
		const added = addToDownloadQueue(store, selectedModelId);
		if (added) {
			logger.info("Added to download queue", { modelId: selectedModelId });
		}
		return false;
	}

	if (restart) {
		try {
			const file = new FileSystem.File(fileUri);
			if (file.exists) {
				await file.delete();
			}
		} catch {
			// ignore delete errors
		}
		store.setCell("aiProviders", PROVIDER_ID, "progressSizeGB", 0);
		cleanupDownloadState(store);
	}

	// Get download options with authentication
	const downloadOptions = await getDownloadOptions();

	// Set download state
	store.setCell("aiProviders", PROVIDER_ID, "filename", localFilename);
	store.setCell(
		"aiProviders",
		PROVIDER_ID,
		"totalSizeGB",
		bytesToGB(fileSizeBytes),
	);
	store.setCell("aiProviders", PROVIDER_ID, "downloadError", "");
	store.setCell("aiProviders", PROVIDER_ID, "isPaused", false);
	store.setCell("aiProviders", PROVIDER_ID, "status", "downloading");

	const currentProgress = store.getCell(
		"aiProviders",
		PROVIDER_ID,
		"progressSizeGB",
	) as number;
	if (!currentProgress) {
		store.setCell("aiProviders", PROVIDER_ID, "progressSizeGB", 0);
	}

	try {
		logger.info("Starting download", { filename: localFilename });
		const resumable = createDownloadResumable(
			maybeProxyUrl(downloadUrl),
			fileUri,
			downloadOptions,
			createProgressCallback(store),
		);

		setActiveDownloadResumable(resumable);

		const result = await resumable.downloadAsync();

		if (checkIfPaused(store)) return true;

		await handleDownloadComplete(store, result ?? null);
		return true;
	} catch (error) {
		logger.error("startDownload error", {
			error: error instanceof Error ? error.message : String(error),
		});
		handleDownloadError(store, error);
		return false;
	}
}
