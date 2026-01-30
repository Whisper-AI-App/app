import {
	mockMainStore,
	resetMockMainStore,
	seedMockMainStore,
} from "../../__mocks__/main-store-mock";

// Mock the store module
jest.mock("../../stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
}));

// Mock expo-device
const mockTotalMemory = jest.fn();
jest.mock("expo-device", () => ({
	get totalMemory() {
		return mockTotalMemory();
	},
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

// Mock whisper-llm-cards - this MUST be before any imports that use it
// Define the mock data that will be used by the module at load time
jest.mock(
	"whisper-llm-cards",
	() => {
		const mockCards = {
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
			"other-card-id": {
				name: "Other Test Model",
				type: "gguf" as const,
				sourceUrl: "https://example.com/other-model.gguf",
				sizeGB: 1.0,
				parametersB: 1,
				ramGB: 4,
				systemMessage: {
					template: "You are a helpful assistant.",
					defaultTemplateValues: {},
				},
			},
		};

		return {
			__esModule: true,
			getLatestConfig: jest.fn(),
			recommendModelCard: jest.fn(),
			whisperLLMCardsJson: {
				version: "1.0.0",
				defaultRecommendedCard: "default-card-id",
				cards: mockCards,
			},
		};
	},
	{ virtual: true },
);

// Store reference to mock for test configuration
const mockWhisperLLMCardsJson = {
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
		"other-card-id": {
			name: "Other Test Model",
			type: "gguf" as const,
			sourceUrl: "https://example.com/other-model.gguf",
			sizeGB: 1.0,
			parametersB: 1,
			ramGB: 4,
			systemMessage: {
				template: "You are a helpful assistant.",
				defaultTemplateValues: {},
			},
		},
	},
};

// Mock the constants module to avoid circular dependency issues
jest.mock("../../actions/ai/constants", () => ({
	DEFAULT_AI_CHAT_MODEL: {
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
}));

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

import * as whisperLLMCards from "whisper-llm-cards";
// Import the functions under test AFTER mocks
import { DEFAULT_AI_CHAT_MODEL } from "../../actions/ai/constants";
import {
	pauseDownload,
	resumeDownload,
	startOrResumeDownloadOfAIChatModel,
} from "../../actions/ai/download-control";
import {
	areCardsEqual,
	checkForModelUpdates,
	fetchLatestRecommendedModel,
	getStoredModelCard,
	updateModelCard,
} from "../../actions/ai/model-config";
import { validateModelFileName } from "../../utils/generate-model-filename";

// Get references to mocked functions
const mockedGetLatestConfig = whisperLLMCards.getLatestConfig as jest.Mock;
const mockedRecommendModelCard =
	whisperLLMCards.recommendModelCard as jest.Mock;

describe("ai-chat-model actions", () => {
	beforeEach(() => {
		resetMockMainStore();
		mockTotalMemory.mockReset();
		mockFileDelete.mockReset();
		mockFileExistsValue = false;
		mockDownloadAsync.mockReset();
		mockPauseAsync.mockReset();
		mockSavable.mockReset();
		mockCreateDownloadResumable.mockClear();
		mockedGetLatestConfig.mockReset();
		mockedRecommendModelCard.mockReset();
		(validateModelFileName as jest.Mock).mockReset();
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("DEFAULT_AI_CHAT_MODEL", () => {
		it("is defined from bundled config", () => {
			expect(DEFAULT_AI_CHAT_MODEL).toBeDefined();
			expect(DEFAULT_AI_CHAT_MODEL.name).toBe("Default Test Model");
		});
	});

	describe("areCardsEqual", () => {
		const card1 = {
			name: "Test Model",
			type: "gguf" as const,
			sourceUrl: "https://example.com/model.gguf",
			sizeGB: 0.5,
			parametersB: 0.5,
			ramGB: 2,
			systemMessage: {
				template: "You are a helpful assistant.",
				defaultTemplateValues: {},
			},
		};

		it("returns true for identical cards", () => {
			const card2 = { ...card1 };
			expect(areCardsEqual(card1, card2)).toBe(true);
		});

		it("returns false for different cards", () => {
			const card2 = { ...card1, name: "Different Model" };
			expect(areCardsEqual(card1, card2)).toBe(false);
		});

		it("returns false when first card is null", () => {
			expect(areCardsEqual(null, card1)).toBe(false);
		});

		it("returns false for cards with different sourceUrl", () => {
			const card2 = { ...card1, sourceUrl: "https://different.com/model.gguf" };
			expect(areCardsEqual(card1, card2)).toBe(false);
		});
	});

	describe("getStoredModelCard", () => {
		it("parses stored JSON correctly", () => {
			const card = {
				name: "Stored Model",
				type: "gguf" as const,
				sourceUrl: "https://example.com/stored.gguf",
				sizeGB: 0.6,
				parametersB: 0.6,
				ramGB: 2,
				systemMessage: {
					template: "You are a helpful assistant.",
					defaultTemplateValues: {},
				},
			};
			seedMockMainStore({
				ai_chat_model_card: JSON.stringify(card),
			});

			const result = getStoredModelCard();

			expect(result).toEqual(card);
		});

		it("returns null when no card stored", () => {
			// No card seeded

			const result = getStoredModelCard();

			expect(result).toBeNull();
		});

		it("returns null for invalid JSON", () => {
			seedMockMainStore({
				ai_chat_model_card: "invalid json {{{",
			});

			const result = getStoredModelCard();

			expect(result).toBeNull();
		});

		it("returns null for empty string", () => {
			seedMockMainStore({
				ai_chat_model_card: "",
			});

			const result = getStoredModelCard();

			expect(result).toBeNull();
		});
	});

	describe("updateModelCard", () => {
		it("updates card, cardId, and config_version", () => {
			const card = {
				name: "New Model",
				type: "gguf" as const,
				sourceUrl: "https://example.com/new.gguf",
				sizeGB: 0.7,
				parametersB: 0.7,
				ramGB: 3,
				systemMessage: {
					template: "You are a helpful assistant.",
					defaultTemplateValues: {},
				},
			};

			updateModelCard(card, "new-card-id", "2.0.0");

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_card",
				JSON.stringify(card),
			);
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_cardId",
				"new-card-id",
			);
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_config_version",
				"2.0.0",
			);
		});
	});

	describe("fetchLatestRecommendedModel", () => {
		it("returns config from network on success", async () => {
			const latestConfig = {
				version: "2.0.0",
				defaultRecommendedCard: "latest-card",
				cards: {
					"latest-card": {
						name: "Latest Model",
						type: "gguf" as const,
						sourceUrl: "https://example.com/latest.gguf",
						sizeGB: 0.8,
						parametersB: 0.8,
						ramGB: 2,
						systemMessage: {
							template: "You are a helpful assistant.",
							defaultTemplateValues: {},
						},
					},
				},
			};
			mockedGetLatestConfig.mockResolvedValue(latestConfig);
			mockedRecommendModelCard.mockReturnValue("latest-card");
			mockTotalMemory.mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB

			const result = await fetchLatestRecommendedModel();

			expect(result.config).toBe(latestConfig);
			expect(result.recommendedCard).toBe(latestConfig.cards["latest-card"]);
			expect(result.cardId).toBe("latest-card");
		});

		it("falls back to bundled default on network error", async () => {
			mockedGetLatestConfig.mockRejectedValue(new Error("Network error"));

			const result = await fetchLatestRecommendedModel();

			expect(result.config).toEqual(mockWhisperLLMCardsJson);
			expect(result.recommendedCard).toEqual(DEFAULT_AI_CHAT_MODEL);
			expect(result.cardId).toBe("default-card-id");
		});

		it("uses device RAM for model recommendation", async () => {
			const latestConfig = { ...mockWhisperLLMCardsJson };
			mockedGetLatestConfig.mockResolvedValue(latestConfig);
			mockedRecommendModelCard.mockReturnValue("default-card-id");
			mockTotalMemory.mockReturnValue(4 * 1024 * 1024 * 1024); // 4GB

			await fetchLatestRecommendedModel();

			expect(mockedRecommendModelCard).toHaveBeenCalledWith(4);
		});
	});

	describe("checkForModelUpdates", () => {
		beforeEach(() => {
			mockedGetLatestConfig.mockResolvedValue(mockWhisperLLMCardsJson);
			mockedRecommendModelCard.mockReturnValue("default-card-id");
			mockTotalMemory.mockReturnValue(8 * 1024 * 1024 * 1024);
		});

		it("returns hasUpdate: false when versions and cards match", async () => {
			const card = mockWhisperLLMCardsJson.cards["default-card-id"];
			seedMockMainStore({
				ai_chat_model_config_version: "1.0.0",
				ai_chat_model_card: JSON.stringify(card),
				ai_chat_model_filename: "default-test-model-v1.0.0-abc123.gguf",
			});
			(validateModelFileName as jest.Mock).mockReturnValue(true);

			const result = await checkForModelUpdates();

			expect(result.hasUpdate).toBe(false);
			expect(result.requiresDownload).toBe(false);
		});

		it("detects version mismatch", async () => {
			const card = mockWhisperLLMCardsJson.cards["default-card-id"];
			seedMockMainStore({
				ai_chat_model_config_version: "0.9.0", // Old version
				ai_chat_model_card: JSON.stringify(card),
				ai_chat_model_filename: "test-model-v0.9.0-abc123.gguf",
			});
			(validateModelFileName as jest.Mock).mockReturnValue(true);

			const result = await checkForModelUpdates();

			expect(result.hasUpdate).toBe(true);
			expect(result.currentVersion).toBe("0.9.0");
			expect(result.newVersion).toBe("1.0.0");
		});

		it("detects filename mismatch (invalid filename)", async () => {
			const card = mockWhisperLLMCardsJson.cards["default-card-id"];
			seedMockMainStore({
				ai_chat_model_config_version: "1.0.0",
				ai_chat_model_card: JSON.stringify(card),
				ai_chat_model_filename: "invalid-filename.gguf",
			});
			(validateModelFileName as jest.Mock).mockReturnValue(false);

			const result = await checkForModelUpdates();

			expect(result.hasUpdate).toBe(true);
			expect(result.requiresDownload).toBe(true);
			expect(result.reason).toBe("filename_invalid");
		});

		it("handles metadata-only updates (same sourceUrl)", async () => {
			// Card with same sourceUrl but different metadata
			const oldCard = {
				...mockWhisperLLMCardsJson.cards["default-card-id"],
				parametersB: 0.4, // Different parameter count
			};
			seedMockMainStore({
				ai_chat_model_config_version: "0.9.0",
				ai_chat_model_card: JSON.stringify(oldCard),
				ai_chat_model_filename: "test-model-v0.9.0-abc123.gguf",
			});
			(validateModelFileName as jest.Mock).mockReturnValue(true);

			const result = await checkForModelUpdates();

			expect(result.hasUpdate).toBe(true);
			// Same sourceUrl means no download required
			expect(result.requiresDownload).toBe(false);
		});
	});

	describe("pauseDownload", () => {
		it("returns early when no active download", async () => {
			await pauseDownload();

			expect(mockPauseAsync).not.toHaveBeenCalled();
			expect(mockMainStore.setValue).not.toHaveBeenCalled();
		});
	});

	describe("resumeDownload", () => {
		it("returns early when no saved resumable state", async () => {
			// No resumable state seeded

			await resumeDownload();

			expect(mockCreateDownloadResumable).not.toHaveBeenCalled();
		});

		it("deserializes state and resumes download", async () => {
			const resumableState = {
				url: "https://example.com/model.gguf",
				options: {},
				resumeData: "mock-resume-data",
			};
			seedMockMainStore({
				ai_chat_model_resumableState: JSON.stringify(resumableState),
				ai_chat_model_fileUri: "file:///mock/documents/model.gguf",
			});
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await resumeDownload();

			expect(mockCreateDownloadResumable).toHaveBeenCalledWith(
				"https://example.com/model.gguf",
				"file:///mock/documents/model.gguf",
				{},
				expect.any(Function),
				"mock-resume-data",
			);
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_isPaused",
				false,
			);
		});
	});

	describe("startOrResumeDownloadOfAIChatModel", () => {
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

		it("starts fresh download", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 200 });
			mockFileExistsValue = false;

			await startOrResumeDownloadOfAIChatModel(
				testCard,
				"test-card-id",
				"1.0.0",
			);

			expect(mockCreateDownloadResumable).toHaveBeenCalled();
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_card",
				JSON.stringify(testCard),
			);
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_cardId",
				"test-card-id",
			);
		});

		it("skips if already downloaded with matching filename", async () => {
			seedMockMainStore({
				ai_chat_model_filename: "test-model-v1.0.0-abc123.gguf",
				ai_chat_model_downloadedAt: "2024-01-01T00:00:00.000Z",
			});

			await startOrResumeDownloadOfAIChatModel(
				testCard,
				"test-card-id",
				"1.0.0",
			);

			expect(mockCreateDownloadResumable).not.toHaveBeenCalled();
		});

		it("resumes paused download when state exists and not restarting", async () => {
			const resumableState = {
				url: "https://example.com/test.gguf",
				options: {},
				resumeData: "mock-resume-data",
			};
			seedMockMainStore({
				ai_chat_model_isPaused: true,
				ai_chat_model_resumableState: JSON.stringify(resumableState),
				ai_chat_model_fileUri: "file:///mock/documents/test.gguf",
			});
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startOrResumeDownloadOfAIChatModel(
				testCard,
				"test-card-id",
				"1.0.0",
			);

			// Should call resumeDownload flow, not fresh download
			expect(mockCreateDownloadResumable).toHaveBeenCalledWith(
				"https://example.com/test.gguf",
				"file:///mock/documents/test.gguf",
				{},
				expect.any(Function),
				"mock-resume-data",
			);
		});

		it("restarts download with restart flag (deletes existing file)", async () => {
			// Use a different filename so the "already downloaded" check doesn't return early
			seedMockMainStore({
				ai_chat_model_filename: "old-model-v0.9.0-xyz789.gguf",
				ai_chat_model_downloadedAt: "2024-01-01T00:00:00.000Z",
				ai_chat_model_isPaused: true,
				ai_chat_model_resumableState: "{}",
			});
			mockFileExistsValue = true;
			mockFileDelete.mockResolvedValue(undefined);
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startOrResumeDownloadOfAIChatModel(
				testCard,
				"test-card-id",
				"1.0.0",
				true, // restart flag
			);

			expect(mockFileDelete).toHaveBeenCalled();
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_progressSizeGB",
				0,
			);
		});

		it("sets downloadedAt on successful completion", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 200 });
			mockFileExistsValue = false;

			await startOrResumeDownloadOfAIChatModel(
				testCard,
				"test-card-id",
				"1.0.0",
			);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_downloadedAt",
				"2024-01-15T10:30:00.000Z",
			);
		});

		it("handles status 206 as successful partial completion", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 206 });
			mockFileExistsValue = false;

			await startOrResumeDownloadOfAIChatModel(
				testCard,
				"test-card-id",
				"1.0.0",
			);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"ai_chat_model_downloadedAt",
				"2024-01-15T10:30:00.000Z",
			);
		});
	});
});
