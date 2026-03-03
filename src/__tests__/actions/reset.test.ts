import {
	mockMainStore,
	resetMockMainStore,
	seedMockMainStore,
} from "../../__mocks__/main-store-mock";

// Mock expo-file-system first (before store mock)
const mockFileDelete = jest.fn();
const mockFileWrite = jest.fn();
let mockFileExists = true;

jest.mock("expo-file-system", () => ({
	File: jest.fn().mockImplementation((...args: unknown[]) => {
		const uri =
			args.length === 2
				? `file:///mock/cache/${args[1]}`
				: String(args[0]);
		return {
			get exists() {
				return mockFileExists;
			},
			delete: mockFileDelete,
			write: mockFileWrite,
			uri,
		};
	}),
	Directory: jest.fn().mockImplementation(() => ({
		uri: "file:///mock/cache",
	})),
	Paths: { document: "file:///mock/documents", cache: "file:///mock/cache" },
}));

// Mock expo-file-system/legacy
const mockGetInfoAsync = jest.fn();
const mockReadAsStringAsync = jest.fn();

jest.mock("expo-file-system/legacy", () => ({
	getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
	readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
}));

// Mock expo-sharing
const mockShareAsync = jest.fn();

jest.mock("expo-sharing", () => ({
	shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

// Mock initMainStore and getModelFileUri functions
const mockInitMainStore = jest.fn();
let mockModelFileUri: string | undefined;

// Mock the store module with all exports
jest.mock("../../stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
	mainStoreFilePath: "file:///mock/documents/whisper.json",
	initMainStore: () => mockInitMainStore(),
	getModelFileUri: () => mockModelFileUri,
}));

// Import the functions under test AFTER mocks
import {
	clearConversations,
	resetEverything,
	saveBackupData,
} from "../../actions/reset";

describe("reset actions", () => {
	beforeEach(() => {
		resetMockMainStore();
		mockInitMainStore.mockReset();
		mockFileDelete.mockReset();
		mockFileWrite.mockReset();
		mockGetInfoAsync.mockReset();
		mockReadAsStringAsync.mockReset();
		mockShareAsync.mockReset();
		mockModelFileUri = undefined;
		mockFileExists = true;
	});

	describe("clearConversations", () => {
		it("deletes chats table", () => {
			clearConversations();

			expect(mockMainStore.delTable).toHaveBeenCalledWith("chats");
		});

		it("deletes messages table", () => {
			clearConversations();

			expect(mockMainStore.delTable).toHaveBeenCalledWith("messages");
		});

		it("preserves values (settings, model metadata)", () => {
			seedMockMainStore({
				name: "John",
				onboardedAt: "2024-01-01T00:00:00.000Z",
				ai_chat_model_downloadedAt: "2024-01-01T00:00:00.000Z",
			});

			clearConversations();

			// Should NOT call delValues
			expect(mockMainStore.delValues).not.toHaveBeenCalled();
		});

		it("clears both tables with a single call", () => {
			seedMockMainStore(
				{},
				{
					chats: { "chat-1": { id: "chat-1", name: "Test", createdAt: "" } },
					messages: {
						"msg-1": {
							id: "msg-1",
							chatId: "chat-1",
							contents: "",
							role: "user",
							createdAt: "",
						},
					},
				},
			);

			clearConversations();

			expect(mockMainStore.delTable).toHaveBeenCalledTimes(2);
			expect(mockMainStore.delTable).toHaveBeenCalledWith("chats");
			expect(mockMainStore.delTable).toHaveBeenCalledWith("messages");
		});
	});

	describe("resetEverything", () => {
		it("deletes model file when it exists", async () => {
			mockModelFileUri = "file:///mock/documents/model.gguf";
			mockFileExists = true;
			mockFileDelete.mockResolvedValue(undefined);

			await resetEverything();

			// 1 model file + 2 store files = 3 deletions
			expect(mockFileDelete).toHaveBeenCalledTimes(3);
		});

		it("skips model file deletion when no model file uri", async () => {
			mockModelFileUri = undefined;
			mockFileExists = true;
			mockFileDelete.mockResolvedValue(undefined);

			await resetEverything();

			// Only 2 store files deleted, no model file
			expect(mockFileDelete).toHaveBeenCalledTimes(2);
		});

		it("skips file deletion when file does not exist", async () => {
			mockModelFileUri = "file:///mock/documents/model.gguf";
			mockFileExists = false;

			await resetEverything();

			expect(mockFileDelete).not.toHaveBeenCalled();
		});

		it("clears all values", async () => {
			mockModelFileUri = undefined;

			await resetEverything();

			expect(mockMainStore.delValues).toHaveBeenCalled();
		});

		it("clears all tables", async () => {
			mockModelFileUri = undefined;

			await resetEverything();

			expect(mockMainStore.delTables).toHaveBeenCalled();
		});

		it("deletes store files from disk", async () => {
			mockModelFileUri = undefined;
			mockFileDelete.mockResolvedValue(undefined);

			await resetEverything();

			// Should delete both the main store file and backup file
			expect(mockFileDelete).toHaveBeenCalledTimes(2);
		});
	});

	describe("saveBackupData", () => {
		beforeEach(() => {
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2024-06-15T12:30:45.123Z"));
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it("uses backup file when it exists", async () => {
			mockGetInfoAsync.mockResolvedValue({ exists: true });
			mockReadAsStringAsync.mockResolvedValue('{"data":"backup"}');
			mockFileWrite.mockResolvedValue(undefined);
			mockShareAsync.mockResolvedValue(undefined);

			await saveBackupData();

			expect(mockGetInfoAsync).toHaveBeenCalledWith(
				"file:///mock/documents/whisper.backup.json",
			);
			expect(mockReadAsStringAsync).toHaveBeenCalledWith(
				"file:///mock/documents/whisper.backup.json",
			);
		});

		it("falls back to main store file when backup does not exist", async () => {
			mockGetInfoAsync.mockResolvedValue({ exists: false });
			mockReadAsStringAsync.mockResolvedValue('{"data":"main"}');
			mockFileWrite.mockResolvedValue(undefined);
			mockShareAsync.mockResolvedValue(undefined);

			await saveBackupData();

			expect(mockReadAsStringAsync).toHaveBeenCalledWith(
				"file:///mock/documents/whisper.json",
			);
		});

		it("writes content to a temp file with timestamped name", async () => {
			mockGetInfoAsync.mockResolvedValue({ exists: false });
			mockReadAsStringAsync.mockResolvedValue('{"store":"data"}');
			mockFileWrite.mockResolvedValue(undefined);
			mockShareAsync.mockResolvedValue(undefined);

			await saveBackupData();

			expect(mockFileWrite).toHaveBeenCalledWith('{"store":"data"}');
		});

		it("shares the temp file with correct options", async () => {
			mockGetInfoAsync.mockResolvedValue({ exists: false });
			mockReadAsStringAsync.mockResolvedValue('{"store":"data"}');
			mockFileWrite.mockResolvedValue(undefined);
			mockShareAsync.mockResolvedValue(undefined);

			await saveBackupData();

			expect(mockShareAsync).toHaveBeenCalledWith(
				expect.stringContaining("whisper-backup-"),
				{
					mimeType: "application/json",
					dialogTitle: "Save Whisper Backup",
				},
			);
		});
	});
});
