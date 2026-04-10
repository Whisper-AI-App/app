import * as FileSystem from "expo-file-system";
import {
	createDownloadResumable,
	type DownloadResumable,
} from "expo-file-system/legacy";
import type { Store } from "tinybase";
import type { WhisperLLMCard } from "whisper-llm-cards";
import { createLogger } from "@/src/logger";
import { bytesToGB } from "../../utils/bytes";
import { maybeProxyUrl } from "../../utils/dev-proxy";
import { generateModelFileName } from "../../utils/generate-model-filename";

const logger = createLogger("WhisperAI:Download");

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
				"whisper-ai",
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
								"whisper-ai",
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
	return store.getCell("aiProviders", "whisper-ai", "isPaused") as boolean;
}

function cleanupDownloadState(store: Store): void {
	store.setCell("aiProviders", "whisper-ai", "downloadError", "");
	store.setCell("aiProviders", "whisper-ai", "resumableState", "");
	store.setCell("aiProviders", "whisper-ai", "isPaused", false);
}

function handleDownloadComplete(
	store: Store,
	result: { status: number } | null,
): void {
	if (result?.status === 200 || result?.status === 206) {
		const now = new Date().toISOString();
		store.setCell("aiProviders", "whisper-ai", "downloadedAt", now);
		store.setCell("aiProviders", "whisper-ai", "status", "ready");
		cleanupDownloadState(store);
		setActiveDownloadResumable(null);
		logger.info("Download complete");
	} else {
		logger.error("Download failed with status", { status: result?.status });
		throw new Error(`Download failed with status: ${result?.status}`);
	}
}

/**
 * Generates a filename for the mmproj file based on card metadata.
 */
function generateMmprojFileName(card: WhisperLLMCard): string {
	const sanitizedName = card.name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.substring(0, 50);
	return `${sanitizedName}-mmproj.gguf`;
}

/**
 * Downloads the mmproj file (phase 2 of model download for vision-capable models).
 * Called after main model download completes.
 */
async function downloadMmproj(
	store: Store,
	card: WhisperLLMCard,
): Promise<void> {
	if (!card.multimodal?.mmproj?.sourceUrl) {
		return;
	}

	const mmprojFilename = generateMmprojFileName(card);
	const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${mmprojFilename}`;

	// Check if already downloaded
	const existingMmproj = store.getCell(
		"aiProviders",
		"whisper-ai",
		"mmprojFilename",
	) as string | undefined;
	if (existingMmproj === mmprojFilename) {
		const file = new FileSystem.File(fileUri);
		if (file.exists) {
			return;
		}
	}

	logger.info("Starting mmproj download", {
		sizeGB: card.multimodal.mmproj.sizeGB,
	});
	store.setCell("aiProviders", "whisper-ai", "status", "downloading_mmproj");
	store.setCell("aiProviders", "whisper-ai", "mmprojFilename", mmprojFilename);
	store.setCell("aiProviders", "whisper-ai", "progressSizeGB", 0);
	store.setCell(
		"aiProviders",
		"whisper-ai",
		"totalSizeGB",
		card.multimodal.mmproj.sizeGB,
	);

	try {
		const resumable = createDownloadResumable(
			maybeProxyUrl(card.multimodal.mmproj.sourceUrl),
			fileUri,
			{},
			createProgressCallback(store),
		);

		setActiveDownloadResumable(resumable);

		const result = await resumable.downloadAsync();

		if (checkIfPaused(store)) return;

		if (result?.status === 200 || result?.status === 206) {
			logger.info("mmproj download complete");
			// mmproj download complete — now mark the whole download as done
			return;
		}
		throw new Error(`mmproj download failed with status: ${result?.status}`);
	} catch (error) {
		logger.error("mmproj download error", {
			error: error instanceof Error ? error.message : String(error),
		});
		handleDownloadError(store, error);
	}
}

function handleDownloadError(store: Store, error: unknown): void {
	if (checkIfPaused(store)) {
		return;
	}

	logger.error("Error occurred", {
		error: error instanceof Error ? error.message : String(error),
	});
	const errorMessage =
		error instanceof Error ? error.message : "Unknown error occurred";
	store.setCell("aiProviders", "whisper-ai", "downloadError", errorMessage);
	store.setCell("aiProviders", "whisper-ai", "isPaused", true);
	setActiveDownloadResumable(null);
	throw error;
}

/**
 * Pauses the current download
 */
export async function pauseDownload(store: Store): Promise<void> {
	if (!activeDownloadResumable) {
		return;
	}

	try {
		await activeDownloadResumable.pauseAsync();
		const savable = activeDownloadResumable.savable();

		store.setCell(
			"aiProviders",
			"whisper-ai",
			"resumableState",
			JSON.stringify(savable),
		);
		store.setCell("aiProviders", "whisper-ai", "isPaused", true);
	} catch (error) {
		logger.error("Error pausing download", {
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

/**
 * Resumes a paused download
 */
export async function resumeDownload(store: Store): Promise<void> {
	const resumableStateStr = store.getCell(
		"aiProviders",
		"whisper-ai",
		"resumableState",
	) as string | undefined;

	if (!resumableStateStr) {
		return;
	}

	try {
		const resumableState = JSON.parse(resumableStateStr);
		const filename = store.getCell(
			"aiProviders",
			"whisper-ai",
			"filename",
		) as string;
		const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${filename}`;

		const resumable = createDownloadResumable(
			resumableState.url,
			fileUri,
			resumableState.options,
			createProgressCallback(store),
			resumableState.resumeData,
		);

		setActiveDownloadResumable(resumable);
		store.setCell("aiProviders", "whisper-ai", "isPaused", false);

		const result = await resumable.downloadAsync();

		if (checkIfPaused(store)) {
			return;
		}

		handleDownloadComplete(store, result ?? null);
	} catch (error) {
		handleDownloadError(store, error);
	}
}

/**
 * Starts or resumes downloading an AI chat model.
 */
export async function startDownload(
	store: Store,
	card: WhisperLLMCard,
	cardId: string,
	configVersion: string,
	restart: boolean = false,
): Promise<void> {
	const sourceUrl = card.sourceUrl;
	const isPaused = store.getCell(
		"aiProviders",
		"whisper-ai",
		"isPaused",
	) as boolean;
	const resumableStateStr = store.getCell(
		"aiProviders",
		"whisper-ai",
		"resumableState",
	) as string | undefined;

	// Generate versioned filename with hash
	const versionedFilename = generateModelFileName(card, configVersion);
	const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${versionedFilename}`;

	const existingFilename = store.getCell(
		"aiProviders",
		"whisper-ai",
		"filename",
	) as string | undefined;

	// If model changed, clear stale download state before the resume check
	if (existingFilename && existingFilename !== versionedFilename) {
		cleanupDownloadState(store);
		store.setCell("aiProviders", "whisper-ai", "progressSizeGB", 0);
	}

	if (isPaused && resumableStateStr && !restart) {
		return resumeDownload(store);
	}
	const downloadedAt = store.getCell(
		"aiProviders",
		"whisper-ai",
		"downloadedAt",
	) as string | undefined;

	// Check if already downloaded
	if (
		existingFilename &&
		downloadedAt &&
		existingFilename === versionedFilename
	) {
		return;
	}

	if (restart) {
		const file = new FileSystem.File(fileUri);
		if (file.exists) {
			await file.delete();
		}
		store.setCell("aiProviders", "whisper-ai", "progressSizeGB", 0);
		cleanupDownloadState(store);
	}

	// Ensure whisper-ai row exists
	if (!store.getRow("aiProviders", "whisper-ai")?.id) {
		store.setRow("aiProviders", "whisper-ai", {
			id: "whisper-ai",
			status: "needs_setup",
			error: "",
			selectedModelId: "",
			modelCard: "",
			modelCardId: "",
			configVersion: "",
			downloadedAt: "",
			filename: "",
			progressSizeGB: 0,
			totalSizeGB: 0,
			downloadError: "",
			resumableState: "",
			isPaused: false,
			fileRemoved: false,
		});
	}

	// Save card metadata
	store.setCell("aiProviders", "whisper-ai", "modelCard", JSON.stringify(card));
	store.setCell("aiProviders", "whisper-ai", "modelCardId", cardId);
	store.setCell("aiProviders", "whisper-ai", "configVersion", configVersion);
	store.setCell("aiProviders", "whisper-ai", "filename", versionedFilename);
	store.setCell("aiProviders", "whisper-ai", "totalSizeGB", card.sizeGB);
	store.setCell("aiProviders", "whisper-ai", "downloadedAt", "");
	store.setCell("aiProviders", "whisper-ai", "downloadError", "");
	store.setCell("aiProviders", "whisper-ai", "isPaused", false);
	store.setCell("aiProviders", "whisper-ai", "status", "downloading");

	const currentProgress = store.getCell(
		"aiProviders",
		"whisper-ai",
		"progressSizeGB",
	) as number;
	if (!currentProgress) {
		store.setCell("aiProviders", "whisper-ai", "progressSizeGB", 0);
	}

	try {
		logger.info("Starting download", { filename: versionedFilename });
		const resumable = createDownloadResumable(
			maybeProxyUrl(sourceUrl),
			fileUri,
			{},
			createProgressCallback(store),
		);

		setActiveDownloadResumable(resumable);

		const result = await resumable.downloadAsync();

		if (checkIfPaused(store)) {
			return;
		}

		if (!(result?.status === 200 || result?.status === 206)) {
			throw new Error(`Download failed with status: ${result?.status}`);
		}

		// Phase 2: Download mmproj if model card has multimodal vision support
		if (card.multimodal?.mmproj?.sourceUrl) {
			await downloadMmproj(store, card);
			if (checkIfPaused(store)) return;
		}

		handleDownloadComplete(store, result ?? null);
	} catch (error) {
		logger.error("startDownload error", {
			error: error instanceof Error ? error.message : String(error),
		});
		handleDownloadError(store, error);
	}
}
