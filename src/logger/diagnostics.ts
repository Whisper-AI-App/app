import * as Device from "expo-device";
import Constants from "expo-constants";
import { getLogs } from "./storage";

export async function generateDiagnosticsReport(): Promise<string> {
	// 1. Get device info
	const modelName = Device.modelName ?? "Unknown";
	const osName = Device.osName ?? "Unknown";
	const osVersion = Device.osVersion ?? "Unknown";
	const totalMemory = Device.totalMemory;

	// 2. Get app version
	const appVersion = Constants.expoConfig?.version ?? "Unknown";

	// 3. Format totalMemory
	let memoryStr: string;
	if (totalMemory != null) {
		const gb = totalMemory / (1024 * 1024 * 1024);
		memoryStr = `${gb.toFixed(1)} GB`;
	} else {
		memoryStr = "Unknown";
	}

	// 4. Get logs from last 7 days, minLevel: info
	const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
	const since = new Date(Date.now() - sevenDaysMs);
	const logs = await getLogs({ since, minLevel: "info" });

	// 5. Format report
	let report = `# Whisper Diagnostics Report\nGenerated: ${new Date().toISOString()}\n\n`;
	report += `## Device Information\n`;
	report += `- App Version: ${appVersion}\n`;
	report += `- Device: ${modelName}\n`;
	report += `- OS: ${osName} ${osVersion}\n`;
	report += `- Total Memory: ${memoryStr}\n\n`;

	report += `## Recent Logs (last 7 days)\n`;
	if (logs.length === 0) {
		report += `No recent logs available.\n`;
	} else {
		for (const log of logs) {
			report += `[${log.timestamp}] ${log.level.toUpperCase()} [${log.module}] ${log.message}\n`;
		}
	}

	report += `\n## Notes\n`;
	report += `- This report contains only operational logs and device information.\n`;
	report += `- No chat messages, conversation content, or personal data is included.\n`;

	return report;
}
