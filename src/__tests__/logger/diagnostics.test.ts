import type { LogEntry } from "@/src/logger/types";

// --- Mock expo-device ---
const mockModelName = jest.fn(() => "iPhone 15 Pro");
const mockOsName = jest.fn(() => "iOS");
const mockOsVersion = jest.fn(() => "18.0");
const mockTotalMemory = jest.fn<number | null, []>(() => 6 * 1024 * 1024 * 1024);
jest.mock("expo-device", () => ({
	get modelName() {
		return mockModelName();
	},
	get osName() {
		return mockOsName();
	},
	get osVersion() {
		return mockOsVersion();
	},
	get totalMemory() {
		return mockTotalMemory();
	},
}));

// --- Mock expo-constants ---
jest.mock("expo-constants", () => ({
	__esModule: true,
	default: {
		expoConfig: {
			version: "1.2.3",
		},
	},
}));

// --- Mock @/src/logger/storage ---
const mockGetLogs = jest.fn<Promise<LogEntry[]>, []>().mockResolvedValue([]);
jest.mock("@/src/logger/storage", () => ({
	getLogs: (...args: unknown[]) => mockGetLogs(...args),
}));

// Import module under test AFTER mocks
import { generateDiagnosticsReport } from "@/src/logger/diagnostics";

describe("logger/diagnostics", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-04-02T12:00:00.000Z"));

		// Reset device mock return values
		mockModelName.mockReturnValue("iPhone 15 Pro");
		mockOsName.mockReturnValue("iOS");
		mockOsVersion.mockReturnValue("18.0");
		mockTotalMemory.mockReturnValue(6 * 1024 * 1024 * 1024);

		mockGetLogs.mockResolvedValue([]);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("report format", () => {
		it("produces plain text with markdown headers", async () => {
			const report = await generateDiagnosticsReport();

			expect(report).toContain("# Whisper Diagnostics Report");
			expect(report).toContain("## Device Information");
			expect(report).toContain("## Recent Logs (last 7 days)");
			expect(report).toContain("## Notes");
		});

		it("includes generated timestamp in ISO format", async () => {
			const report = await generateDiagnosticsReport();

			expect(report).toContain("Generated: 2026-04-02T12:00:00.000Z");
		});
	});

	describe("device info fields", () => {
		it("includes modelName", async () => {
			const report = await generateDiagnosticsReport();

			expect(report).toContain("- Device: iPhone 15 Pro");
		});

		it("includes osName and osVersion", async () => {
			const report = await generateDiagnosticsReport();

			expect(report).toContain("- OS: iOS 18.0");
		});

		it("includes totalMemory formatted as GB with 1 decimal place", async () => {
			const report = await generateDiagnosticsReport();

			expect(report).toContain("- Total Memory: 6.0 GB");
		});

		it("shows 'Unknown' when totalMemory is null", async () => {
			mockTotalMemory.mockReturnValue(null);

			const report = await generateDiagnosticsReport();

			expect(report).toContain("- Total Memory: Unknown");
		});

		it("includes appVersion from expo-constants", async () => {
			const report = await generateDiagnosticsReport();

			expect(report).toContain("- App Version: 1.2.3");
		});
	});

	describe("log filtering", () => {
		it("requests logs from the last 7 days with minLevel info", async () => {
			await generateDiagnosticsReport();

			expect(mockGetLogs).toHaveBeenCalledTimes(1);
			const callArgs = mockGetLogs.mock.calls[0][0] as {
				since: Date;
				minLevel: string;
			};
			expect(callArgs.minLevel).toBe("info");

			// The since date should be approximately 7 days before the current time
			const now = new Date("2026-04-02T12:00:00.000Z");
			const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
			const actualDiff = now.getTime() - callArgs.since.getTime();
			expect(actualDiff).toBe(sevenDaysMs);
		});

		it("includes info, warn, and error entries in the report", async () => {
			mockGetLogs.mockResolvedValue([
				{
					timestamp: "2026-04-01T10:00:00.000Z",
					level: "info",
					module: "Chat",
					message: "chat started",
				},
				{
					timestamp: "2026-04-01T11:00:00.000Z",
					level: "warn",
					module: "Model",
					message: "low memory",
				},
				{
					timestamp: "2026-04-01T12:00:00.000Z",
					level: "error",
					module: "Download",
					message: "network timeout",
				},
			]);

			const report = await generateDiagnosticsReport();

			expect(report).toContain("[2026-04-01T10:00:00.000Z] INFO [Chat] chat started");
			expect(report).toContain("[2026-04-01T11:00:00.000Z] WARN [Model] low memory");
			expect(report).toContain("[2026-04-01T12:00:00.000Z] ERROR [Download] network timeout");
		});

		it("does not include debug entries (filtered by getLogs minLevel)", async () => {
			// getLogs is mocked, so we verify the correct minLevel is passed
			// and that the report only shows what getLogs returns
			mockGetLogs.mockResolvedValue([
				{
					timestamp: "2026-04-01T10:00:00.000Z",
					level: "info",
					module: "Chat",
					message: "info entry",
				},
			]);

			const report = await generateDiagnosticsReport();

			expect(report).not.toContain("DEBUG");
			expect(report).toContain("INFO");
		});
	});

	describe("privacy guarantee", () => {
		it("includes privacy notes in the report", async () => {
			const report = await generateDiagnosticsReport();

			expect(report).toContain(
				"- This report contains only operational logs and device information.",
			);
			expect(report).toContain(
				"- No chat messages, conversation content, or personal data is included.",
			);
		});

		it("does not contain user content - only operational log data", async () => {
			mockGetLogs.mockResolvedValue([
				{
					timestamp: "2026-04-01T10:00:00.000Z",
					level: "info",
					module: "Chat",
					message: "chat created",
				},
			]);

			const report = await generateDiagnosticsReport();

			// Report should only contain device info, log messages (operational), and notes
			// No chat content fields like "contents" or user messages
			expect(report).not.toContain("contents");
			expect(report).not.toContain("chatId");
			expect(report).not.toContain("role");
		});
	});

	describe("empty logs case", () => {
		it("generates report with 'no recent logs' note when no logs exist", async () => {
			mockGetLogs.mockResolvedValue([]);

			const report = await generateDiagnosticsReport();

			expect(report).toContain("# Whisper Diagnostics Report");
			expect(report).toContain("## Device Information");
			expect(report).toContain("## Recent Logs (last 7 days)");
			expect(report).toContain("No recent logs available.");
			expect(report).toContain("## Notes");
		});
	});
});
