import type { LogEntry } from "@/src/logger/types";

// Mock the storage layer
const mockAppendLogs = jest.fn<Promise<void>, [LogEntry[]]>().mockResolvedValue(undefined);
jest.mock("@/src/logger/storage", () => ({
	appendLogs: (...args: unknown[]) => mockAppendLogs(...args),
}));

// Mock react-native AppState
const mockRemove = jest.fn();
const mockAddEventListener = jest.fn().mockReturnValue({ remove: mockRemove });
jest.mock("react-native", () => ({
	AppState: {
		addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
		currentState: "active",
	},
}));

// Import Logger AFTER mocks are set up
import { Logger } from "@/src/logger/logger";

describe("Logger", () => {
	let originalDev: boolean;

	beforeEach(() => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-04-02T12:00:00.000Z"));
		mockAppendLogs.mockClear();
		mockAddEventListener.mockClear();
		mockRemove.mockClear();
		originalDev = (global as Record<string, unknown>).__DEV__ as boolean;
		(global as Record<string, unknown>).__DEV__ = true;
	});

	afterEach(() => {
		jest.useRealTimers();
		(global as Record<string, unknown>).__DEV__ = originalDev;
	});

	describe("buffered writes", () => {
		it("does not immediately write to storage when logging", () => {
			const logger = new Logger("TestModule");

			logger.info("hello world");

			expect(mockAppendLogs).not.toHaveBeenCalled();
		});

		it("buffers multiple entries without writing", () => {
			const logger = new Logger("TestModule");

			logger.info("first");
			logger.info("second");
			logger.warn("third");

			expect(mockAppendLogs).not.toHaveBeenCalled();
		});
	});

	describe("5s flush interval", () => {
		it("flushes buffered entries to storage after 5 seconds", () => {
			const logger = new Logger("TestModule");

			logger.info("buffered message");

			jest.advanceTimersByTime(5000);

			expect(mockAppendLogs).toHaveBeenCalledTimes(1);
			expect(mockAppendLogs).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						level: "info",
						module: "TestModule",
						message: "buffered message",
					}),
				]),
			);
		});

		it("does not flush when buffer is empty", () => {
			new Logger("TestModule");

			jest.advanceTimersByTime(5000);

			expect(mockAppendLogs).not.toHaveBeenCalled();
		});

		it("flushes repeatedly at 5-second intervals", () => {
			const logger = new Logger("TestModule");

			logger.info("first batch");
			jest.advanceTimersByTime(5000);

			expect(mockAppendLogs).toHaveBeenCalledTimes(1);

			logger.info("second batch");
			jest.advanceTimersByTime(5000);

			expect(mockAppendLogs).toHaveBeenCalledTimes(2);
		});
	});

	describe("immediate flush on error", () => {
		it("flushes immediately when .error() is called", () => {
			const logger = new Logger("TestModule");

			logger.error("something went wrong");

			expect(mockAppendLogs).toHaveBeenCalledTimes(1);
			expect(mockAppendLogs).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						level: "error",
						message: "something went wrong",
					}),
				]),
			);
		});

		it("flushes all buffered entries along with the error entry", () => {
			const logger = new Logger("TestModule");

			logger.info("before error");
			logger.warn("also before error");
			logger.error("the error");

			expect(mockAppendLogs).toHaveBeenCalledTimes(1);
			const flushedEntries = mockAppendLogs.mock.calls[0][0] as LogEntry[];
			expect(flushedEntries).toHaveLength(3);
			expect(flushedEntries[0]).toMatchObject({
				level: "info",
				message: "before error",
			});
			expect(flushedEntries[1]).toMatchObject({
				level: "warn",
				message: "also before error",
			});
			expect(flushedEntries[2]).toMatchObject({
				level: "error",
				message: "the error",
			});
		});
	});

	describe("AppState background flush", () => {
		it("registers an AppState listener on construction", () => {
			new Logger("TestModule");

			expect(mockAddEventListener).toHaveBeenCalledWith(
				"change",
				expect.any(Function),
			);
		});

		it("flushes buffer when app goes to background", () => {
			const logger = new Logger("TestModule");

			logger.info("should flush on background");

			// Get the AppState change handler that was registered
			const changeHandler = mockAddEventListener.mock.calls[0][1] as (
				state: string,
			) => void;

			changeHandler("background");

			expect(mockAppendLogs).toHaveBeenCalledTimes(1);
			expect(mockAppendLogs).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						message: "should flush on background",
					}),
				]),
			);
		});

		it("does not flush when app becomes active", () => {
			const logger = new Logger("TestModule");

			logger.info("should not flush");

			const changeHandler = mockAddEventListener.mock.calls[0][1] as (
				state: string,
			) => void;

			changeHandler("active");

			expect(mockAppendLogs).not.toHaveBeenCalled();
		});
	});

	describe("production debug filtering", () => {
		it("discards debug entries when __DEV__ is false", () => {
			(global as Record<string, unknown>).__DEV__ = false;

			const logger = new Logger("TestModule");

			logger.debug("debug message in prod");

			// Force a flush to verify nothing was buffered
			jest.advanceTimersByTime(5000);

			expect(mockAppendLogs).not.toHaveBeenCalled();
		});

		it("buffers debug entries when __DEV__ is true", () => {
			(global as Record<string, unknown>).__DEV__ = true;

			const logger = new Logger("TestModule");

			logger.debug("debug message in dev");

			jest.advanceTimersByTime(5000);

			expect(mockAppendLogs).toHaveBeenCalledTimes(1);
			expect(mockAppendLogs).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						level: "debug",
						message: "debug message in dev",
					}),
				]),
			);
		});

		it("still buffers info, warn, and error in production", () => {
			(global as Record<string, unknown>).__DEV__ = false;

			const logger = new Logger("TestModule");

			logger.info("info in prod");
			logger.warn("warn in prod");
			logger.error("error in prod");

			// error triggers immediate flush
			expect(mockAppendLogs).toHaveBeenCalledTimes(1);
			const flushedEntries = mockAppendLogs.mock.calls[0][0] as LogEntry[];
			expect(flushedEntries).toHaveLength(3);
			expect(flushedEntries.map((e) => e.level)).toEqual([
				"info",
				"warn",
				"error",
			]);
		});
	});

	describe("module tagging", () => {
		it("tags each entry with the module name from constructor", () => {
			const logger = new Logger("ChatService");

			logger.info("test message");

			jest.advanceTimersByTime(5000);

			expect(mockAppendLogs).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						module: "ChatService",
					}),
				]),
			);
		});

		it("different loggers tag entries with their own module names", () => {
			const logger1 = new Logger("ModuleA");
			const logger2 = new Logger("ModuleB");

			logger1.info("from A");
			logger1.error("flush A");

			const entriesA = mockAppendLogs.mock.calls[0][0] as LogEntry[];
			expect(entriesA.every((e) => e.module === "ModuleA")).toBe(true);

			mockAppendLogs.mockClear();

			logger2.info("from B");
			logger2.error("flush B");

			const entriesB = mockAppendLogs.mock.calls[0][0] as LogEntry[];
			expect(entriesB.every((e) => e.module === "ModuleB")).toBe(true);
		});
	});

	describe("timestamp generation", () => {
		it("creates entries with valid ISO 8601 timestamps", () => {
			const logger = new Logger("TestModule");

			logger.info("timestamped");

			jest.advanceTimersByTime(5000);

			const entries = mockAppendLogs.mock.calls[0][0] as LogEntry[];
			const timestamp = entries[0].timestamp;

			// Verify it's a valid ISO 8601 string
			expect(new Date(timestamp).toISOString()).toBe(timestamp);
		});

		it("uses the current time for each entry", () => {
			const logger = new Logger("TestModule");

			logger.info("first");
			jest.setSystemTime(new Date("2026-04-02T12:05:00.000Z"));
			logger.info("second");

			jest.advanceTimersByTime(5000);

			const entries = mockAppendLogs.mock.calls[0][0] as LogEntry[];
			expect(entries[0].timestamp).toBe("2026-04-02T12:00:00.000Z");
			expect(entries[1].timestamp).toBe("2026-04-02T12:05:00.000Z");
		});
	});

	describe("metadata passing", () => {
		it("includes metadata in log entries when provided", () => {
			const logger = new Logger("TestModule");

			logger.info("with meta", { userId: "abc", count: 42 });

			jest.advanceTimersByTime(5000);

			expect(mockAppendLogs).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						message: "with meta",
						metadata: { userId: "abc", count: 42 },
					}),
				]),
			);
		});

		it("omits metadata field when not provided", () => {
			const logger = new Logger("TestModule");

			logger.info("no meta");

			jest.advanceTimersByTime(5000);

			const entries = mockAppendLogs.mock.calls[0][0] as LogEntry[];
			expect(entries[0].metadata).toBeUndefined();
		});

		it("passes metadata for all log levels", () => {
			const logger = new Logger("TestModule");
			const meta = { key: "value" };

			logger.debug("debug", meta);
			logger.info("info", meta);
			logger.warn("warn", meta);
			logger.error("error", meta);

			// error triggers immediate flush of all entries
			const entries = mockAppendLogs.mock.calls[0][0] as LogEntry[];
			for (const entry of entries) {
				expect(entry.metadata).toEqual(meta);
			}
		});
	});

	describe("manual flush", () => {
		it("flushes buffer when .flush() is called", async () => {
			const logger = new Logger("TestModule");

			logger.info("manual flush entry");

			await logger.flush();

			expect(mockAppendLogs).toHaveBeenCalledTimes(1);
			expect(mockAppendLogs).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						message: "manual flush entry",
					}),
				]),
			);
		});

		it("does not flush when buffer is empty", async () => {
			const logger = new Logger("TestModule");

			await logger.flush();

			expect(mockAppendLogs).not.toHaveBeenCalled();
		});

		it("clears the buffer after flushing", async () => {
			const logger = new Logger("TestModule");

			logger.info("should be cleared");

			await logger.flush();

			expect(mockAppendLogs).toHaveBeenCalledTimes(1);

			// Advance timer to trigger interval flush - should have nothing to flush
			jest.advanceTimersByTime(5000);

			expect(mockAppendLogs).toHaveBeenCalledTimes(1);
		});
	});
});
