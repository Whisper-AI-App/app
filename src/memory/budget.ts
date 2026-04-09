import * as Device from "expo-device";
import { createLogger } from "@/src/logger";
import { getAvailableMemory } from "../utils/native-memory";
import { estimateModelRAM } from "./estimator";

const logger = createLogger("MemoryBudget");

// ─── Device Memory Tier ──────────────────────────────────────

export type DeviceMemoryTier =
	| "minimal"        // ≤ 3 GB
	| "conservative"   // 4 GB
	| "balanced"       // 6 GB
	| "full"           // 8 GB
	| "unrestricted";  // ≥ 12 GB

export interface TierStrategy {
	maxChatModelGB: number;
	preWarmVision: boolean;
	preWarmSTT: boolean;
	allowOnDemandVision: boolean;
	allowOnDemandSTT: boolean;
	/** Release STT model immediately after transcription to reclaim ~150MB for chat inference. */
	releaseSTTAfterUse: boolean;
}

export const TIER_STRATEGIES: Record<DeviceMemoryTier, TierStrategy> = {
	minimal: {
		maxChatModelGB: 0.5,
		preWarmVision: false,
		preWarmSTT: false,
		allowOnDemandVision: false,
		allowOnDemandSTT: true,
		releaseSTTAfterUse: true,
	},
	conservative: {
		maxChatModelGB: 1.5,
		preWarmVision: false,
		preWarmSTT: false,
		allowOnDemandVision: false,
		allowOnDemandSTT: true,
		releaseSTTAfterUse: true,
	},
	balanced: {
		maxChatModelGB: 2.0,
		preWarmVision: false,
		preWarmSTT: true,
		allowOnDemandVision: true,
		allowOnDemandSTT: true,
		releaseSTTAfterUse: false,
	},
	full: {
		maxChatModelGB: 4.0,
		preWarmVision: true,
		preWarmSTT: true,
		allowOnDemandVision: true,
		allowOnDemandSTT: true,
		releaseSTTAfterUse: false,
	},
	unrestricted: {
		maxChatModelGB: 8.0,
		preWarmVision: true,
		preWarmSTT: true,
		allowOnDemandVision: true,
		allowOnDemandSTT: true,
		releaseSTTAfterUse: false,
	},
};

// ─── Budget Check ────────────────────────────────────────────

export interface MemoryBudgetResult {
	canLoad: boolean;
	availableBytes: number;
	estimatedModelBytes: number;
	source: "native" | "fallback";
}

const DEFAULT_HEADROOM_FACTOR = 1.3;

/**
 * Determine device memory tier from total RAM in GB.
 */
export function getDeviceMemoryTier(totalMemoryGB: number): DeviceMemoryTier {
	if (totalMemoryGB <= 3) return "minimal";
	if (totalMemoryGB <= 5) return "conservative";
	if (totalMemoryGB <= 7) return "balanced";
	if (totalMemoryGB <= 10) return "full";
	return "unrestricted";
}

/**
 * Get the tier strategy for the current device.
 */
export function getDeviceTierStrategy(): TierStrategy {
	const totalBytes = Device.totalMemory ?? 4 * 1024 * 1024 * 1024;
	const totalGB = totalBytes / (1024 * 1024 * 1024);
	const tier = getDeviceMemoryTier(totalGB);
	return TIER_STRATEGIES[tier];
}

/**
 * Check if there's enough memory to safely load a model.
 *
 * @param modelSizeGB - Model file size in GB (≈ weight memory)
 * @param contextSize - Context window size (affects KV cache memory)
 * @param headroomFactor - Safety margin multiplier (default 1.3 = 30%)
 * @returns Budget check result
 */
export async function checkBudget(
	modelSizeGB: number,
	contextSize: number,
	headroomFactor: number = DEFAULT_HEADROOM_FACTOR,
): Promise<MemoryBudgetResult> {
	const estimatedModelBytes = estimateModelRAM(modelSizeGB, contextSize);
	const { bytes: availableBytes, source } = await getAvailableMemory();

	const canLoad = availableBytes >= estimatedModelBytes * headroomFactor;

	logger.info("checkBudget", {
		estimatedModelMB: (estimatedModelBytes / (1024 * 1024)).toFixed(1),
		availableMB: (availableBytes / (1024 * 1024)).toFixed(1),
		source,
		headroomFactor,
		requiredWithHeadroomMB: ((estimatedModelBytes * headroomFactor) / (1024 * 1024)).toFixed(1),
		canLoad,
	});

	return {
		canLoad,
		availableBytes,
		estimatedModelBytes,
		source,
	};
}
