import * as Device from "expo-device";

/**
 * Get available memory in bytes using the native expo-memory module.
 * Falls back to a conservative estimate (Device.totalMemory * 0.4) if the
 * native module is unavailable.
 *
 * @returns {{ bytes: number; source: "native" | "fallback" }}
 */
export async function getAvailableMemory(): Promise<{
	bytes: number;
	source: "native" | "fallback";
}> {
	try {
		// Dynamic import so the app still builds if the native module isn't linked
		const { getAvailableMemory: nativeGet } = await import(
			"../../modules/expo-memory/src/index"
		);
		const bytes = await nativeGet();
		if (bytes > 0) {
			return { bytes, source: "native" };
		}
	} catch {
		// Native module not available — fall through to fallback
	}

	// Conservative fallback: assume 40% of total RAM is available
	const totalMemory = Device.totalMemory ?? 4 * 1024 * 1024 * 1024; // default 4GB
	return { bytes: totalMemory * 0.4, source: "fallback" };
}

/**
 * Get total device memory in bytes (wrapper around expo-device).
 */
export function getTotalMemory(): number {
	return Device.totalMemory ?? 4 * 1024 * 1024 * 1024;
}
