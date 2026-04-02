import type { LogEntry } from "@/src/logger/types";

// --- Mock expo-file-system (new File/Directory API) ---
const mockText = jest.fn();
const mockWrite = jest.fn();
const mockDelete = jest.fn();
let mockExists = false;

jest.mock("expo-file-system", () => ({
	Paths: {
		document: "/mock/documents",
	},
	Directory: jest.fn(),
	File: jest.fn().mockImplementation(() => ({
		get exists() {
			return mockExists;
		},
		text: (...args: unknown[]) => mockText(...args),
		write: (...args: unknown[]) => mockWrite(...args),
		delete: (...args: unknown[]) => mockDelete(...args),
		uri: "/mock/documents/whisper-logs.jsonl",
	})),
}));

// Import module under test AFTER mocks are registered
import {
	appendLogs,
	getLogs,
	clearLogs,
	pruneIfNeeded,
} from "@/src/logger/storage";

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
	return {
		timestamp: "2026-04-01T12:00:00.000Z",
		level: "info",
		module: "test",
		message: "test message",
		...overrides,
	};
}

function toJSONL(entries: LogEntry[]): string {
	return entries.map((e) => JSON.stringify(e)).join("\n");
}

describe("logger/storage", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockExists = false;
		mockText.mockResolvedValue("");
		mockWrite.mockResolvedValue(undefined);
		mockDelete.mockResolvedValue(undefined);
	});

	// ---------------------------------------------------------------
	// appendLogs
	// ---------------------------------------------------------------
	describe("appendLogs", () => {
		it("writes entries as one JSON object per line (JSONL)", async () => {
			const entries: LogEntry[] = [
				makeEntry({ message: "first" }),
				makeEntry({ message: "second", level: "warn" }),
			];

			await appendLogs(entries);

			expect(mockWrite).toHaveBeenCalledTimes(1);

			const writtenContent = mockWrite.mock.calls[0][0] as string;
			const lines = writtenContent.split("\n").filter(Boolean);
			expect(lines).toHaveLength(2);

			const parsed0 = JSON.parse(lines[0]);
			expect(parsed0.message).toBe("first");

			const parsed1 = JSON.parse(lines[1]);
			expect(parsed1.message).toBe("second");
			expect(parsed1.level).toBe("warn");
		});

		it("appends to existing file content", async () => {
			const existing = toJSONL([makeEntry({ message: "existing" })]);
			mockExists = true;
			mockText.mockResolvedValue(existing);

			await appendLogs([makeEntry({ message: "new" })]);

			expect(mockWrite).toHaveBeenCalledTimes(1);

			const writtenContent = mockWrite.mock.calls[0][0] as string;
			const lines = writtenContent.split("\n").filter(Boolean);
			expect(lines).toHaveLength(2);
			expect(JSON.parse(lines[0]).message).toBe("existing");
			expect(JSON.parse(lines[1]).message).toBe("new");
		});
	});

	// ---------------------------------------------------------------
	// getLogs
	// ---------------------------------------------------------------
	describe("getLogs", () => {
		it("returns empty array when file does not exist", async () => {
			mockExists = false;

			const result = await getLogs();

			expect(result).toEqual([]);
		});

		it("returns empty array for empty file", async () => {
			mockExists = true;
			mockText.mockResolvedValue("");

			const result = await getLogs();

			expect(result).toEqual([]);
		});

		it("parses all entries from JSONL file", async () => {
			const entries = [
				makeEntry({ message: "a" }),
				makeEntry({ message: "b" }),
				makeEntry({ message: "c" }),
			];
			mockExists = true;
			mockText.mockResolvedValue(toJSONL(entries));

			const result = await getLogs();

			expect(result).toHaveLength(3);
			expect(result[0].message).toBe("a");
			expect(result[1].message).toBe("b");
			expect(result[2].message).toBe("c");
		});

		describe("since filter", () => {
			it("returns only entries after the given date", async () => {
				const entries = [
					makeEntry({ timestamp: "2026-03-01T00:00:00.000Z", message: "old" }),
					makeEntry({ timestamp: "2026-04-01T00:00:00.000Z", message: "new" }),
					makeEntry({ timestamp: "2026-04-02T00:00:00.000Z", message: "newest" }),
				];
				mockExists = true;
				mockText.mockResolvedValue(toJSONL(entries));

				const result = await getLogs({
					since: new Date("2026-03-15T00:00:00.000Z"),
				});

				expect(result).toHaveLength(2);
				expect(result[0].message).toBe("newest");
				expect(result[1].message).toBe("new");
			});
		});

		describe("minLevel filter", () => {
			it("returns only entries at or above the given level", async () => {
				const entries = [
					makeEntry({ level: "debug", message: "debug msg" }),
					makeEntry({ level: "info", message: "info msg" }),
					makeEntry({ level: "warn", message: "warn msg" }),
					makeEntry({ level: "error", message: "error msg" }),
				];
				mockExists = true;
				mockText.mockResolvedValue(toJSONL(entries));

				const result = await getLogs({ minLevel: "warn" });

				expect(result).toHaveLength(2);
				expect(result[0].message).toBe("warn msg");
				expect(result[1].message).toBe("error msg");
			});

			it("error-only returns only error entries", async () => {
				const entries = [
					makeEntry({ level: "debug", message: "d" }),
					makeEntry({ level: "info", message: "i" }),
					makeEntry({ level: "warn", message: "w" }),
					makeEntry({ level: "error", message: "e" }),
				];
				mockExists = true;
				mockText.mockResolvedValue(toJSONL(entries));

				const result = await getLogs({ minLevel: "error" });

				expect(result).toHaveLength(1);
				expect(result[0].message).toBe("e");
				expect(result[0].level).toBe("error");
			});

			it("info minLevel excludes debug entries (production suppression)", async () => {
				const entries = [
					makeEntry({ level: "debug", message: "debug noise" }),
					makeEntry({ level: "info", message: "info entry" }),
					makeEntry({ level: "warn", message: "warn entry" }),
					makeEntry({ level: "error", message: "error entry" }),
				];
				mockExists = true;
				mockText.mockResolvedValue(toJSONL(entries));

				const result = await getLogs({ minLevel: "info" });

				expect(result).toHaveLength(3);
				expect(result.every((e) => e.level !== "debug")).toBe(true);
				expect(result[0].message).toBe("info entry");
			});
		});

		describe("limit filter", () => {
			it("caps returned entries to the specified limit", async () => {
				const entries = [
					makeEntry({ message: "a" }),
					makeEntry({ message: "b" }),
					makeEntry({ message: "c" }),
					makeEntry({ message: "d" }),
					makeEntry({ message: "e" }),
				];
				mockExists = true;
				mockText.mockResolvedValue(toJSONL(entries));

				const result = await getLogs({ limit: 3 });

				expect(result).toHaveLength(3);
			});
		});

		describe("combined filters", () => {
			it("applies since, minLevel, and limit together", async () => {
				const entries = [
					makeEntry({ timestamp: "2026-01-01T00:00:00.000Z", level: "debug", message: "old debug" }),
					makeEntry({ timestamp: "2026-01-01T00:00:00.000Z", level: "error", message: "old error" }),
					makeEntry({ timestamp: "2026-04-01T00:00:00.000Z", level: "debug", message: "new debug" }),
					makeEntry({ timestamp: "2026-04-01T00:00:00.000Z", level: "info", message: "new info" }),
					makeEntry({ timestamp: "2026-04-01T00:00:00.000Z", level: "warn", message: "new warn" }),
					makeEntry({ timestamp: "2026-04-01T00:00:00.000Z", level: "error", message: "new error 1" }),
					makeEntry({ timestamp: "2026-04-02T00:00:00.000Z", level: "error", message: "new error 2" }),
				];
				mockExists = true;
				mockText.mockResolvedValue(toJSONL(entries));

				const result = await getLogs({
					since: new Date("2026-03-01T00:00:00.000Z"),
					minLevel: "warn",
					limit: 2,
				});

				// After since: new debug, new info, new warn, new error 1, new error 2
				// After minLevel>=warn: new warn, new error 1, new error 2
				// Sorted newest first: new error 2 (Apr 2), then new warn, new error 1 (Apr 1, stable order)
				// After limit 2: new error 2, new warn
				expect(result).toHaveLength(2);
				expect(result[0].message).toBe("new error 2");
				expect(result[1].message).toBe("new warn");
			});
		});
	});

	// ---------------------------------------------------------------
	// clearLogs
	// ---------------------------------------------------------------
	describe("clearLogs", () => {
		it("deletes the log file when it exists", async () => {
			mockExists = true;

			await clearLogs();

			expect(mockDelete).toHaveBeenCalledTimes(1);
		});

		it("does nothing when file does not exist", async () => {
			mockExists = false;

			await clearLogs();

			expect(mockDelete).not.toHaveBeenCalled();
		});
	});

	// ---------------------------------------------------------------
	// pruneIfNeeded
	// ---------------------------------------------------------------
	describe("pruneIfNeeded", () => {
		it("does nothing when file is under 2MB", async () => {
			// Small content under 2MB
			const smallContent = toJSONL([makeEntry({ message: "small" })]);
			mockExists = true;
			mockText.mockResolvedValue(smallContent);

			await pruneIfNeeded();

			// Should read to check size but not write
			expect(mockWrite).not.toHaveBeenCalled();
		});

		it("does nothing when file does not exist", async () => {
			mockExists = false;

			await pruneIfNeeded();

			expect(mockText).not.toHaveBeenCalled();
			expect(mockWrite).not.toHaveBeenCalled();
		});

		it("keeps newest 50% of entries when file exceeds 2MB", async () => {
			const entries = [
				makeEntry({ timestamp: "2026-01-01T00:00:00.000Z", message: "oldest" }),
				makeEntry({ timestamp: "2026-02-01T00:00:00.000Z", message: "old" }),
				makeEntry({ timestamp: "2026-03-01T00:00:00.000Z", message: "recent" }),
				makeEntry({ timestamp: "2026-04-01T00:00:00.000Z", message: "newest" }),
			];

			// Generate content larger than 2MB
			const largeContent = toJSONL(entries);
			mockExists = true;

			// Mock TextEncoder to report size > 2MB
			const originalTextEncoder = global.TextEncoder;
			const mockEncode = jest.fn().mockReturnValue({ length: 3 * 1024 * 1024 });
			global.TextEncoder = jest.fn().mockImplementation(() => ({
				encode: mockEncode,
			})) as unknown as typeof TextEncoder;

			mockText.mockResolvedValue(largeContent);

			await pruneIfNeeded();

			expect(mockWrite).toHaveBeenCalledTimes(1);

			const writtenContent = mockWrite.mock.calls[0][0] as string;
			const remainingLines = writtenContent.split("\n").filter(Boolean);

			// 50% of 4 entries = 2 newest entries kept
			expect(remainingLines).toHaveLength(2);

			const remaining = remainingLines.map((l: string) => JSON.parse(l));
			expect(remaining[0].message).toBe("recent");
			expect(remaining[1].message).toBe("newest");

			global.TextEncoder = originalTextEncoder;
		});
	});
});
