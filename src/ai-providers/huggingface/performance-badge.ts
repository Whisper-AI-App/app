import type { PerformanceTier } from "./types";

/**
 * Calculate performance badge tier based on device RAM to GGUF file size ratio.
 *
 * Higher ratio = more headroom = better performance.
 * Thresholds calibrated against typical mobile devices:
 * - 6GB RAM device + 1GB model = 6.0x = "Very Well"
 * - 6GB RAM device + 1.5GB model = 4.0x = "Well"
 * - 6GB RAM device + 2.4GB model = 2.5x = "Okay"
 * - 6GB RAM device + 4GB model = 1.5x = "Poorly"
 * - 4GB RAM device + 4GB model = 1.0x = "Badly"
 */
export function getPerformanceBadge(
	deviceRAMBytes: number,
	fileSizeBytes: number,
): PerformanceTier {
	if (fileSizeBytes <= 0) return "Very Well";
	const ratio = deviceRAMBytes / fileSizeBytes;
	if (ratio >= 6.0) return "Very Well";
	if (ratio >= 4.0) return "Well";
	if (ratio >= 2.5) return "Okay";
	if (ratio >= 1.5) return "Poorly";
	return "Badly";
}
