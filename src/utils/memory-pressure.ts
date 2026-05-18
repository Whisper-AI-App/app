import { AppState, type NativeEventSubscription } from "react-native";
import { createLogger } from "@/src/logger";
import { dispatch, getCapabilityStatus } from "../memory/state";

const logger = createLogger("MemoryPressure");

/**
 * Tiered memory pressure handler integrated with the capability state machine.
 *
 * Tier 1: Call releaseMultimodal() (~670MB freed) → vision transitions to "releasing" → "unloaded"
 * Tier 2: Never auto-release chat model (OS kills process if needed)
 *
 * Each OS memory warning escalates to the next available tier.
 */

let subscription: NativeEventSubscription | null = null;
let releaseMultimodalFn: (() => Promise<void>) | null = null;
let onTierChanged: ((tier: number, action: string) => void) | null = null;

/**
 * Set the callback for releasing multimodal (vision) resources.
 * This is set by the WhisperAI provider when a vision model is loaded.
 */
export function setReleaseMultimodalFn(fn: (() => Promise<void>) | null): void {
	releaseMultimodalFn = fn;
}

/**
 * Set a callback that fires when a memory tier is triggered.
 * Used to update UI (show toast, update capability flags).
 */
export function setOnTierChanged(fn: ((tier: number, action: string) => void) | null): void {
	onTierChanged = fn;
}

/**
 * Handle a memory pressure event. Escalates through tiers based on
 * the current capability state machine status.
 */
async function handleMemoryWarning(): Promise<void> {
	const visionStatus = getCapabilityStatus("vision");

	// Tier 1: Release multimodal (mmproj/vision) if loaded
	if (visionStatus === "ready" && releaseMultimodalFn) {
		dispatch("vision", { type: "MEMORY_PRESSURE" });
		try {
			await releaseMultimodalFn();
			dispatch("vision", { type: "RELEASE_COMPLETE" });
			logger.warn("Tier 1: released multimodal/vision", { freedMB: 670 });
			onTierChanged?.(1, "Released vision capability to free memory");
		} catch (err) {
			logger.error("failed to release multimodal", { error: String(err) });
			dispatch("vision", { type: "RELEASE_COMPLETE" });
		}
		return;
	}

	// Tier 2: Never auto-release chat model
	logger.warn("no more resources to release, chat model preserved");
}

/**
 * Start listening for memory pressure events.
 * Call this once at app startup.
 */
export function startMemoryPressureMonitor(): void {
	if (subscription) return;

	subscription = AppState.addEventListener("memoryWarning", () => {
		handleMemoryWarning();
	});
}

/**
 * Stop listening for memory pressure events.
 */
export function stopMemoryPressureMonitor(): void {
	subscription?.remove();
	subscription = null;
}
