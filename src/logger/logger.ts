/** biome-ignore-all lint/suspicious/noConsole: This is the only file in our src/ that should stream logs to dev server via console.*() */
import { AppState } from "react-native";
import { appendLogs } from "./storage";
import type { LogEntry, LogLevel } from "./types";

export class Logger {
	private module: string;
	private buffer: LogEntry[];

	constructor(module: string) {
		this.module = module;
		this.buffer = [];
		setInterval(() => {
			void this.flush();
		}, 5000);
		AppState.addEventListener("change", (state) => {
			if (state === "background") {
				void this.flush();
			}
		});
	}

	private createEntry(
		level: LogLevel,
		message: string,
		metadata?: Record<string, unknown>,
	): LogEntry {
		const entry: LogEntry = {
			timestamp: new Date().toISOString(),
			level,
			module: this.module,
			message,
		};
		if (metadata) {
			entry.metadata = metadata;
		}
		return entry;
	}

	debug(message: string, metadata?: Record<string, unknown>): void {
		if (!__DEV__) return;
		const entry = this.createEntry("debug", message, metadata);
		console.debug(`[${entry.module}]`, entry.message, entry.metadata ?? "");
		this.buffer.push(entry);
	}

	info(message: string, metadata?: Record<string, unknown>): void {
		const entry = this.createEntry("info", message, metadata);
		console.info(`[${entry.module}]`, entry.message, entry.metadata ?? "");
		this.buffer.push(entry);
	}

	warn(message: string, metadata?: Record<string, unknown>): void {
		const entry = this.createEntry("warn", message, metadata);
		console.warn(`[${entry.module}]`, entry.message, entry.metadata ?? "");
		this.buffer.push(entry);
	}

	error(message: string, metadata?: Record<string, unknown>): void {
		const entry = this.createEntry("error", message, metadata);
		console.error(`[${entry.module}]`, entry.message, entry.metadata ?? "");
		this.buffer.push(entry);
		void this.flush();
	}

	async flush(): Promise<void> {
		if (this.buffer.length === 0) return;
		const entries = this.buffer.splice(0);
		await appendLogs(entries);
	}
}
