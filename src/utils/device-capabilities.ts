import * as Device from "expo-device";
import type { DeviceCapabilities } from "whisper-llm-cards";

/**
 * Maps expo-device DeviceType enum to our string values.
 */
function mapDeviceType(
	deviceType: Device.DeviceType | null,
): DeviceCapabilities["deviceType"] {
	switch (deviceType) {
		case Device.DeviceType.PHONE:
			return "phone";
		case Device.DeviceType.TABLET:
			return "tablet";
		case Device.DeviceType.DESKTOP:
			return "desktop";
		case Device.DeviceType.TV:
			return "tv";
		default:
			return "unknown";
	}
}

/**
 * Maps OS name to our platform values.
 * iPadOS is treated as iOS for llama.rn purposes.
 */
function mapPlatform(
	osName: string | null,
): DeviceCapabilities["platform"] {
	const name = osName?.toLowerCase() ?? "unknown";
	if (name === "ipados") return "ios";
	if (name === "ios") return "ios";
	if (name === "android") return "android";
	if (name === "windows") return "windows";
	// Fallback to android for unknown platforms (conservative for GPU layers)
	return "android";
}

/**
 * Collects device capabilities for runtime config resolution.
 * Uses expo-device for most values and a custom module for CPU core count.
 *
 * @returns Device capabilities object for use with resolveRuntimeConfig
 */
export function getDeviceCapabilities(): DeviceCapabilities {
	const ramBytes = Device.totalMemory;
	const ramGB = ramBytes ? ramBytes / 1e9 : 4; // fallback to 4GB

	const platform = mapPlatform(Device.osName);
	const deviceType = mapDeviceType(Device.deviceType);
	const modelName = Device.modelName ?? undefined;
	const cpuArch = Device.supportedCpuArchitectures?.[0] ?? undefined;

	// Try to get CPU core count from native module
	let cpuCoreCount: number | undefined;
	try {
		// Dynamic import to handle cases where native module isn't available (e.g., Expo Go)
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { getCoreCount } = require("@/modules/device-cpu-cores");
		cpuCoreCount = getCoreCount();
	} catch {
		// Native module not available, leave undefined
	}

	return {
		ramGB,
		platform,
		deviceType,
		modelName,
		cpuArch,
		cpuCoreCount,
	};
}
