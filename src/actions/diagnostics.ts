import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { createLogger } from "@/src/logger";
import { generateDiagnosticsReport } from "@/src/logger/diagnostics";

const logger = createLogger("Diagnostics");

/**
 * Generates a diagnostics report and shares it via the system share sheet.
 */
export async function shareDiagnostics(): Promise<void> {
	const report = await generateDiagnosticsReport();
	const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
	const fileName = `whisper-diagnostics-${timestamp}.txt`;
	const cacheDir = new FileSystem.Directory(FileSystem.Paths.cache);
	const tempFile = new FileSystem.File(cacheDir, fileName);

	try {
		await tempFile.write(report);
		const fileUri = tempFile.uri;
		logger.info("diagnostics report written", { fileUri });

		const isAvailable = await Sharing.isAvailableAsync();
		if (!isAvailable) {
			logger.warn("sharing not available on this device");
			return;
		}

		await Sharing.shareAsync(fileUri, {
			mimeType: "text/plain",
			dialogTitle: "Share Diagnostics Report",
		});

		logger.info("diagnostics report shared");
	} catch (error) {
		logger.error("failed to share diagnostics report", {
			error: String(error),
		});
		throw error;
	} finally {
		try {
			if (tempFile.exists) {
				await tempFile.delete();
			}
		} catch {
			// Non-critical: cache files are cleaned up by the OS eventually
		}
	}
}
