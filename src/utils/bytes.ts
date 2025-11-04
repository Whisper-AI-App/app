/**
 * Converts bytes to GB
 */
export function bytesToGB(bytes: number): number {
	return bytes / (1024 * 1024 * 1024);
}
