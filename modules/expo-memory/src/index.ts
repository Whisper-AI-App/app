import { NativeModule, requireNativeModule } from "expo";

declare class ExpoMemoryModule extends NativeModule {
	getAvailableMemory(): Promise<number>;
}

const ExpoMemory = requireNativeModule<ExpoMemoryModule>("ExpoMemory");

/**
 * Get available memory in bytes from the native OS.
 * iOS: os_proc_available_memory()
 * Android: ActivityManager.getMemoryInfo().availMem
 * @returns Available memory in bytes, or -1 if unavailable
 */
export async function getAvailableMemory(): Promise<number> {
	return ExpoMemory.getAvailableMemory();
}
