export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
	timestamp: string;
	level: LogLevel;
	module: string;
	message: string;
	metadata?: Record<string, unknown>;
}

export interface LoggerConfig {
	maxFileSizeBytes: number;
	pruneRatio: number;
	flushIntervalMs: number;
	minLevel: LogLevel;
}

export interface Logger {
	debug(message: string, metadata?: Record<string, unknown>): void;
	info(message: string, metadata?: Record<string, unknown>): void;
	warn(message: string, metadata?: Record<string, unknown>): void;
	error(message: string, metadata?: Record<string, unknown>): void;
}

export interface GetLogsOptions {
	since?: Date;
	minLevel?: LogLevel;
	limit?: number;
}

export const LOG_LEVEL_VALUES: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
} as const;
