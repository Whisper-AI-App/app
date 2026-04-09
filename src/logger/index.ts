import { Logger as LoggerClass } from "./logger";
export { getLogs, clearLogs } from "./storage";
export type { LogLevel, LogEntry, GetLogsOptions, Logger } from "./types";

const instances: LoggerClass[] = [];

export function createLogger(module: string): LoggerClass {
	const logger = new LoggerClass(module);
	instances.push(logger);
	return logger;
}

export async function flushLogs(): Promise<void> {
	await Promise.all(instances.map((l) => l.flush()));
}
