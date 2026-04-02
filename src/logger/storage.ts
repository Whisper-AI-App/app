import * as FileSystem from "expo-file-system";
import type { LogEntry, GetLogsOptions } from "./types";
import { LOG_LEVEL_VALUES } from "./types";

const LOG_FILE_NAME = "whisper-logs.jsonl";
const docDir = new FileSystem.Directory(FileSystem.Paths.document);
const logFile = new FileSystem.File(docDir, LOG_FILE_NAME);

const MAX_FILE_SIZE_BYTES = 2_097_152; // 2MB

export async function appendLogs(entries: LogEntry[]): Promise<void> {
	if (entries.length === 0) return;

	const newLines = entries.map((entry) => JSON.stringify(entry)).join("\n");

	let existing = "";
	try {
		if (logFile.exists) {
			existing = await logFile.text();
		}
	} catch {
		// File doesn't exist yet or read failed
	}

	const content = existing ? `${existing}\n${newLines}` : newLines;
	await logFile.write(content);

	await pruneIfNeeded();
}

export async function getLogs(options?: GetLogsOptions): Promise<LogEntry[]> {
	let raw: string;
	try {
		if (!logFile.exists) return [];
		raw = await logFile.text();
	} catch {
		return [];
	}

	if (!raw.trim()) return [];

	let entries: LogEntry[] = raw
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line) as LogEntry);

	if (options?.since) {
		const sinceTime = options.since.getTime();
		entries = entries.filter(
			(entry) => new Date(entry.timestamp).getTime() >= sinceTime,
		);
	}

	if (options?.minLevel) {
		const minValue = LOG_LEVEL_VALUES[options.minLevel];
		entries = entries.filter(
			(entry) => LOG_LEVEL_VALUES[entry.level] >= minValue,
		);
	}

	entries.sort(
		(a, b) =>
			new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);

	if (options?.limit) {
		entries = entries.slice(0, options.limit);
	}

	return entries;
}

export async function clearLogs(): Promise<void> {
	try {
		if (logFile.exists) {
			await logFile.delete();
		}
	} catch {
		// Already deleted or doesn't exist
	}
}

export async function pruneIfNeeded(): Promise<void> {
	try {
		if (!logFile.exists) return;
	} catch {
		return;
	}

	const raw = await logFile.text();
	const size = new TextEncoder().encode(raw).length;
	if (size <= MAX_FILE_SIZE_BYTES) return;

	const lines = raw.split("\n").filter((line) => line.trim());
	const keepCount = Math.ceil(lines.length / 2);
	const kept = lines.slice(-keepCount);
	await logFile.write(kept.join("\n"));
}
