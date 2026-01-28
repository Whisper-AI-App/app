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
	startOrResumeDownloadOfAIChatModel,
} from "../../actions/ai/download-control";
import { setActiveDownloadResumable } from "../../actions/ai/state";
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
		 * The bug was that navigation happened immediately when starting a download,
		 * rather than only when downloadedAt was set. When pausing, the user was
		 * already navigated away because startOrResumeDownloadOfAIChatModel
		 * called router.replace() immediately.
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

			// Seed some download state
			seedMockMainStore({
				ai_chat_model_filename: "test-model-v1.0.0-abc123.gguf",
				ai_chat_model_fileUri: "file:///mock/documents/test-model-v1.0.0-abc123.gguf",
				ai_chat_model_isPaused: false,
			});

			// Act: Pause the download
			await pauseDownload();

			// Assert: isPaused should be true
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_isPaused",
				true,
			);

			// Assert: downloadedAt should NOT be set (this would trigger navigation)
			expect(mockMainStore.setValue).not.toHaveBeenCalledWith(
				"ai_chat_model_downloadedAt",
				expect.anything(),
			);

			// Assert: resumable state should be saved for later resumption
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_resumableState",
				expect.any(String),
			);
		});

		it("does not modify store when no active download exists", async () => {
			// Setup: No active download
			setActiveDownloadResumable(null);

			// Act: Try to pause (should be no-op)
			await pauseDownload();

			// Assert: No store modifications
			expect(mockMainStore.setValue).not.toHaveBeenCalled();
			expect(mockPauseAsync).not.toHaveBeenCalled();
		});
	});

	describe("startOrResumeDownloadOfAIChatModel state management", () => {
		/**
		 * These tests verify that the download function properly manages state
		 * without directly controlling navigation (which is now handled by the component).
		 */

		it("sets isPaused to false when starting download", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startOrResumeDownloadOfAIChatModel(
				testCard,
				"test-card-id",
				"1.0.0",
			);

			// Verify isPaused was set to false when download started
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_isPaused",
				false,
			);
		});

		it("only sets downloadedAt on successful completion", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 200 });
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));

			await startOrResumeDownloadOfAIChatModel(
				testCard,
				"test-card-id",
				"1.0.0",
			);

			// downloadedAt should be set ONLY after successful download
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_downloadedAt",
				"2024-01-15T10:30:00.000Z",
			);

			jest.useRealTimers();
		});

		it("does not set downloadedAt when download is paused mid-way", async () => {
			// Simulate download being paused during downloadAsync
			mockDownloadAsync.mockImplementation(async () => {
				// Simulate user pausing during download
				seedMockMainStore({ ai_chat_model_isPaused: true });
				return null; // Download returns null when paused
			});

			await startOrResumeDownloadOfAIChatModel(
				testCard,
				"test-card-id",
				"1.0.0",
			);

			// downloadedAt should NOT be set because download was paused
			expect(mockMainStore.setValue).not.toHaveBeenCalledWith(
				"ai_chat_model_downloadedAt",
				expect.anything(),
			);
		});

		it("does not set downloadedAt on download failure", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 500 });

			try {
				await startOrResumeDownloadOfAIChatModel(
					testCard,
					"test-card-id",
					"1.0.0",
				);
			} catch {
				// Expected to throw
			}

			// downloadedAt should NOT be set on failure
			const setValueCalls = mockMainStore.setValue.mock.calls;
			const downloadedAtCalls = setValueCalls.filter(
				(call: unknown[]) => call[0] === "ai_chat_model_downloadedAt",
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
			startOrResumeDownloadOfAIChatModel(testCard, "test-card-id", "1.0.0");

			// Should set isPaused to false
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_isPaused",
				false,
			);

			// Should not have downloadedAt yet
			const setValueCalls = mockMainStore.setValue.mock.calls;
			const downloadedAtCalls = setValueCalls.filter(
				(call: unknown[]) => call[0] === "ai_chat_model_downloadedAt",
			);
			expect(downloadedAtCalls.length).toBe(0);
		});

		it("tracks correct state transition: downloading -> completed", async () => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2024-01-15T12:00:00.000Z"));
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startOrResumeDownloadOfAIChatModel(
				testCard,
				"test-card-id",
				"1.0.0",
			);

			// After completion, downloadedAt should be set
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_downloadedAt",
				"2024-01-15T12:00:00.000Z",
			);

			// isPaused should be cleared (via cleanupDownloadState)
			expect(mockMainStore.delValue).toHaveBeenCalledWith(
				"ai_chat_model_isPaused",
			);

			jest.useRealTimers();
		});
	});
});
