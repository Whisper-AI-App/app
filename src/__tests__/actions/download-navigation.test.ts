import {
	mockMainStore,
	resetMockMainStore,
	seedMockMainStore,
} from "../../__mocks__/main-store-mock";

// Mock the store module
jest.mock("../../stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
}));

// Mock expo-file-system
const mockFileDelete = jest.fn();
let mockFileExistsValue = false;

jest.mock("expo-file-system", () => ({
	File: jest.fn().mockImplementation(() => ({
		get exists() {
			return mockFileExistsValue;
		},
		delete: (...args: unknown[]) => mockFileDelete(...args),
	})),
	Directory: jest.fn().mockImplementation(() => ({
		uri: "file:///mock/documents",
	})),
	Paths: { document: "file:///mock/documents" },
}));

// Mock expo-file-system/legacy
const mockDownloadAsync = jest.fn();
const mockPauseAsync = jest.fn();
const mockSavable = jest.fn();
const mockCreateDownloadResumable = jest.fn().mockImplementation(() => ({
	downloadAsync: mockDownloadAsync,
	pauseAsync: mockPauseAsync,
	savable: mockSavable,
}));

jest.mock("expo-file-system/legacy", () => ({
	__esModule: true,
	createDownloadResumable: (...args: unknown[]) =>
		mockCreateDownloadResumable(...args),
}));

// Mock whisper-llm-cards
jest.mock(
	"whisper-llm-cards",
	() => ({
		__esModule: true,
		getLatestConfig: jest.fn(),
		recommendModelCard: jest.fn(),
		whisperLLMCardsJson: {
			version: "1.0.0",
			defaultRecommendedCard: "default-card-id",
			cards: {
				"default-card-id": {
					name: "Default Test Model",
					type: "gguf" as const,
					sourceUrl: "https://example.com/default-model.gguf",
					sizeGB: 0.5,
					parametersB: 0.5,
					ramGB: 2,
					systemMessage: {
						template: "You are a helpful assistant.",
						defaultTemplateValues: {},
					},
				},
			},
		},
	}),
	{ virtual: true },
);

// Mock utility functions
jest.mock("../../utils/bytes", () => ({
	bytesToGB: jest.fn((bytes: number) => bytes / (1024 * 1024 * 1024)),
}));

jest.mock("../../utils/generate-model-filename", () => ({
	generateModelFileName: jest.fn(
		(card: { name: string }, version: string) =>
			`${card.name.toLowerCase().replace(/\s+/g, "-")}-v${version}-abc123.gguf`,
	),
	validateModelFileName: jest.fn(() => true),
}));

// Import after mocks
import {
	pauseDownload,
	setActiveDownloadResumable,
	startDownload,
} from "../../ai-providers/whisper-ai/download";
import type { DownloadResumable } from "expo-file-system/legacy";

describe("Download navigation behavior", () => {
	const testCard = {
		name: "Test Model",
		type: "gguf" as const,
		sourceUrl: "https://example.com/test.gguf",
		sizeGB: 0.5,
		parametersB: 0.5,
		ramGB: 2,
		systemMessage: {
			template: "You are a helpful assistant.",
			defaultTemplateValues: {},
		},
	};

	beforeEach(() => {
		resetMockMainStore();
		mockFileDelete.mockReset();
		mockFileExistsValue = false;
		mockDownloadAsync.mockReset();
		mockPauseAsync.mockReset();
		mockSavable.mockReset();
		mockCreateDownloadResumable.mockClear();
	});

	describe("pauseDownload behavior (Issue #72 fix verification)", () => {
		/**
		 * This test verifies the fix for Issue #72:
		 * "Pausing download after purge on iOS skips straight to chat list without the model"
		 *
		 * The fix ensures:
		 * 1. pauseDownload sets isPaused to true
		 * 2. pauseDownload does NOT set downloadedAt
		 * 3. Navigation should only trigger when downloadedAt is set (component-level logic)
		 */
		it("sets isPaused to true without setting downloadedAt", async () => {
			// Setup: Create an active download resumable mock
			const mockResumable = {
				downloadAsync: mockDownloadAsync,
				pauseAsync: mockPauseAsync.mockResolvedValue(undefined),
				savable: mockSavable.mockReturnValue({
					url: "https://example.com/test.gguf",
					options: {},
					resumeData: "mock-resume-data",
				}),
			};

			// Simulate starting a download by setting the active resumable
			setActiveDownloadResumable(mockResumable as unknown as DownloadResumable);

			// Seed aiProviders row with download state
			seedMockMainStore(undefined, {
				aiProviders: {
					"whisper-ai": {
						id: "whisper-ai",
						filename: "test-model-v1.0.0-abc123.gguf",
						isPaused: false,
					},
				},
			});

			// Act: Pause the download
			await pauseDownload(mockMainStore as any);

			// Assert: isPaused should be true
			expect(mockMainStore.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"whisper-ai",
				"isPaused",
				true,
			);

			// Assert: downloadedAt should NOT be set (this would trigger navigation)
			expect(mockMainStore.setCell).not.toHaveBeenCalledWith(
				"aiProviders",
				"whisper-ai",
				"downloadedAt",
				expect.anything(),
			);

			// Assert: resumable state should be saved for later resumption
			expect(mockMainStore.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"whisper-ai",
				"resumableState",
				expect.any(String),
			);
		});

		it("does not modify store when no active download exists", async () => {
			// Setup: No active download
			setActiveDownloadResumable(null);

			// Act: Try to pause (should be no-op)
			await pauseDownload(mockMainStore as any);

			// Assert: No store modifications
			expect(mockMainStore.setCell).not.toHaveBeenCalled();
			expect(mockPauseAsync).not.toHaveBeenCalled();
		});
	});

	describe("startDownload state management", () => {
		/**
		 * These tests verify that the download function properly manages state
		 * without directly controlling navigation (which is now handled by the component).
		 */

		it("sets isPaused to false when starting download", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startDownload(
				mockMainStore as any,
				testCard,
				"test-card-id",
				"1.0.0",
			);

			// Verify isPaused was set to false when download started
			expect(mockMainStore.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"whisper-ai",
				"isPaused",
				false,
			);
		});

		it("only sets downloadedAt on successful completion", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 200 });
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));

			await startDownload(
				mockMainStore as any,
				testCard,
				"test-card-id",
				"1.0.0",
			);

			// downloadedAt should be set ONLY after successful download
			expect(mockMainStore.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"whisper-ai",
				"downloadedAt",
				"2024-01-15T10:30:00.000Z",
			);

			jest.useRealTimers();
		});

		it("does not set downloadedAt when download is paused mid-way", async () => {
			// Simulate download being paused during downloadAsync
			mockDownloadAsync.mockImplementation(async () => {
				// Simulate user pausing during download
				seedMockMainStore(undefined, {
					aiProviders: {
						"whisper-ai": {
							isPaused: true,
						},
					},
				});
				return null; // Download returns null when paused
			});

			await startDownload(
				mockMainStore as any,
				testCard,
				"test-card-id",
				"1.0.0",
			);

			// downloadedAt should NOT be set because download was paused
			const setCellCalls = mockMainStore.setCell.mock.calls;
			const downloadedAtCalls = setCellCalls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "whisper-ai" &&
					call[2] === "downloadedAt" &&
					call[3] !== "", // Ignore the initial empty string set
			);
			expect(downloadedAtCalls.length).toBe(0);
		});

		it("does not set downloadedAt on download failure", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 500 });

			try {
				await startDownload(
					mockMainStore as any,
					testCard,
					"test-card-id",
					"1.0.0",
				);
			} catch {
				// Expected to throw
			}

			// downloadedAt should NOT be set on failure (only empty string initialization)
			const setCellCalls = mockMainStore.setCell.mock.calls;
			const downloadedAtCalls = setCellCalls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "whisper-ai" &&
					call[2] === "downloadedAt" &&
					call[3] !== "", // Ignore the initial empty string set
			);
			expect(downloadedAtCalls.length).toBe(0);
		});
	});

	describe("Download state transitions", () => {
		/**
		 * These tests verify the state machine for downloads:
		 * - idle -> downloading (isPaused: false, no downloadedAt)
		 * - downloading -> paused (isPaused: true, no downloadedAt)
		 * - downloading -> completed (downloadedAt set)
		 * - paused -> downloading (isPaused: false)
		 */

		it("tracks correct state transition: idle -> downloading", async () => {
			// Start with clean state
			mockDownloadAsync.mockImplementation(() => new Promise(() => {})); // Never resolves

			// Start the download (don't await - it never resolves)
			startDownload(
				mockMainStore as any,
				testCard,
				"test-card-id",
				"1.0.0",
			);

			// Should set isPaused to false
			expect(mockMainStore.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"whisper-ai",
				"isPaused",
				false,
			);

			// Should not have downloadedAt set yet (only empty string initialization)
			const setCellCalls = mockMainStore.setCell.mock.calls;
			const downloadedAtCalls = setCellCalls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "whisper-ai" &&
					call[2] === "downloadedAt" &&
					call[3] !== "",
			);
			expect(downloadedAtCalls.length).toBe(0);
		});

		it("tracks correct state transition: downloading -> completed", async () => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startDownload(
				mockMainStore as any,
				testCard,
				"test-card-id",
				"1.0.0",
			);

			// After completion, downloadedAt should be set
			expect(mockMainStore.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"whisper-ai",
				"downloadedAt",
				"2024-01-15T12:00:00.000Z",
			);

			// isPaused should be cleared (via cleanupDownloadState)
			// It gets set to false multiple times - during start and during cleanup
			expect(mockMainStore.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"whisper-ai",
				"isPaused",
				false,
			);

			jest.useRealTimers();
		});
	});
});
