import type { DownloadResumable } from "expo-file-system/legacy";

// Keep a reference to the active download
let activeDownloadResumable: DownloadResumable | null = null;

export function getActiveDownloadResumable(): DownloadResumable | null {
	return activeDownloadResumable;
}

export function setActiveDownloadResumable(
	resumable: DownloadResumable | null,
): void {
	activeDownloadResumable = resumable;
}
