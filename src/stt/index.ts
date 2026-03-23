import { Asset } from "expo-asset";
import { checkBudget, getDeviceTierStrategy } from "../memory/budget";
import { dispatch, getCapabilityStatus } from "../memory/state";
import * as whisperSTT from "./whisper-stt";

type STTStatus = "uninitialized" | "initializing" | "ready" | "released";

let status: STTStatus = "uninitialized";
let initPromise: Promise<void> | null = null;
let contextId: number | null = null;
let jobCounter = 0;

// Whisper-tiny model size in GB (bundled asset, ~75MB)
const WHISPER_MODEL_SIZE_GB = 0.075;

/**
 * Get the current STT service status.
 */
export function getSTTStatus(): STTStatus {
	return status;
}

/**
 * Check if the STT service is available and ready for transcription.
 */
export function isAvailable(): boolean {
	return status === "ready";
}

/**
 * Initialize the STT service by loading the whisper model.
 * Performs a memory budget check before loading.
 * Safe to call multiple times — subsequent calls are no-ops if already initialized.
 */
export async function initSTT(): Promise<void> {
	if (status === "ready" || status === "initializing") {
		return initPromise ?? Promise.resolve();
	}

	status = "initializing";

	initPromise = (async () => {
		try {
			// T068: Budget check before loading whisper context
			const budget = await checkBudget(WHISPER_MODEL_SIZE_GB, 0);
			if (!budget.canLoad) {
				console.warn(
					`[STT] Budget denied: ${(budget.availableBytes / (1024 * 1024 * 1024)).toFixed(1)}GB avail, ` +
					`${(budget.estimatedModelBytes / (1024 * 1024 * 1024)).toFixed(1)}GB needed (${budget.source})`,
				);
				status = "uninitialized";
				throw new Error("Not enough memory to load speech-to-text model");
			}

			// Load whisper model from bundled asset
			const [asset] = await Asset.loadAsync(
				// eslint-disable-next-line @typescript-eslint/no-require-imports
				require("../../assets/models/ggml-tiny.bin"),
			);

			if (!asset.localUri) {
				throw new Error("Failed to resolve whisper model asset path");
			}

			console.log("[STT] Loading whisper model from:", asset.localUri);
			contextId = await whisperSTT.initWhisper(asset.localUri);
			status = "ready";
			console.log("[STT] Whisper model loaded successfully, contextId:", contextId);
		} catch (error) {
			console.error("[STT] Failed to initialize whisper:", error);
			status = "uninitialized";
			contextId = null;
			throw error;
		}
	})();

	return initPromise;
}

/**
 * Transcribe an audio file to text.
 * If the STT service is not ready, attempts budget-checked lazy init first.
 *
 * @param audioUri - Path to the audio file
 * @returns Transcribed text string
 */
export async function getTranscription(audioUri: string): Promise<string> {
	if (status !== "ready") {
		// T068: On-demand loading path with budget check via lazy init
		if (status === "uninitialized" || status === "released") {
			const sttState = getCapabilityStatus("stt");
			// Only dispatch if not already in a loading/ready state
			if (sttState === "unloaded" || sttState === "budget_denied") {
				dispatch("stt", sttState === "budget_denied"
					? { type: "RETRY" }
					: { type: "USER_REQUEST" });
			}

			try {
				await initSTT();
				dispatch("stt", { type: "LOAD_SUCCESS" });
			} catch (err) {
				// Determine if it was a budget issue or other error
				const isBudget = err instanceof Error && err.message.includes("Not enough memory");
				if (isBudget) {
					dispatch("stt", { type: "LOAD_FAIL_BUDGET" });
				} else {
					dispatch("stt", { type: "LOAD_FAIL_ERROR", error: String(err) });
				}
				throw err;
			}
		} else if (status === "initializing") {
			await initPromise;
		}
	}

	if (contextId === null) {
		throw new Error("Whisper context not initialized");
	}

	const jobId = ++jobCounter;
	const text = await whisperSTT.transcribe(contextId, jobId, audioUri);

	// On low-memory devices, release STT immediately to reclaim ~75MB for chat inference.
	// This prevents the whisper model from competing with llama.rn for scarce RAM,
	// which would otherwise cause noticeably slower token generation.
	const tier = getDeviceTierStrategy();
	if (tier.releaseSTTAfterUse) {
		console.log("[STT] Releasing whisper model after transcription (low-memory tier)");
		dispatch("stt", { type: "MEMORY_PRESSURE" });
		await releaseSTT();
		dispatch("stt", { type: "RELEASE_COMPLETE" });
	}

	return text;
}

/**
 * Release the whisper context (Tier 1 memory pressure response).
 * Frees ~75MB of RAM. Can be reloaded on demand.
 */
export async function releaseSTT(): Promise<void> {
	if (contextId !== null) {
		await whisperSTT.release(contextId);
		contextId = null;
	}
	status = "released";
	initPromise = null;
}
