import {
	mockMainStore,
	resetMockMainStore,
	seedMockMainStore,
} from "../../__mocks__/main-store-mock";

// Mock expo-crypto
const mockDecryptedBytes = new TextEncoder().encode('{"decrypted":"data"}');
const mockAesDecryptAsync = jest.fn().mockResolvedValue(mockDecryptedBytes);

jest.mock("expo-crypto", () => ({
	AESEncryptionKey: {
		import: jest.fn().mockResolvedValue("mock-key"),
	},
	AESSealedData: {
		fromCombined: jest.fn().mockReturnValue("mock-sealed"),
	},
	aesDecryptAsync: (...args: unknown[]) => mockAesDecryptAsync(...args),
}));

// Mock expo-file-system first (before store mock)
const mockFileDelete = jest.fn();
const mockFileWrite = jest.fn();
const mockFileBytes = jest.fn();
const mockFileText = jest.fn();
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
			bytes: mockFileBytes,
			text: mockFileText,
			uri,
		};
	}),
	Directory: jest.fn().mockImplementation(() => ({
		uri: "file:///mock/cache",
	})),
	Paths: { document: "file:///mock/documents", cache: "file:///mock/cache" },
}));

// Mock expo-sharing
const mockShareAsync = jest.fn();

jest.mock("expo-sharing", () => ({
	shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

// Mock encryption key loader
const mockLoadEncryptionKey = jest.fn();

jest.mock("../../stores/main/encryption-key", () => ({
	ENCRYPTION_KEY_STORE_ID: "whisper_encryption_key",
	loadEncryptionKey: () => mockLoadEncryptionKey(),
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
		mockFileBytes.mockReset();
		mockFileText.mockReset();
		mockShareAsync.mockReset();
		mockLoadEncryptionKey.mockReset();
		mockAesDecryptAsync.mockReset();
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

			// 1 model file + 1 store file = 2 deletions
			expect(mockFileDelete).toHaveBeenCalledTimes(2);
		});

		it("skips model file deletion when no model file uri", async () => {
			mockModelFileUri = undefined;
			mockFileExists = true;
			mockFileDelete.mockResolvedValue(undefined);

			await resetEverything();

			// Only 1 store file deleted, no model file
			expect(mockFileDelete).toHaveBeenCalledTimes(1);
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

		it("deletes store file from disk", async () => {
			mockModelFileUri = undefined;
			mockFileDelete.mockResolvedValue(undefined);

			await resetEverything();

			expect(mockFileDelete).toHaveBeenCalledTimes(1);
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

		it("decrypts file when encryption key exists", async () => {
			mockLoadEncryptionKey.mockResolvedValue("aabbccdd".repeat(8));
			mockFileBytes.mockResolvedValue(new Uint8Array([1, 2, 3]));
			mockAesDecryptAsync.mockResolvedValue(
				new TextEncoder().encode('{"decrypted":"data"}'),
			);
			mockShareAsync.mockResolvedValue(undefined);

			await saveBackupData();

			expect(mockFileBytes).toHaveBeenCalled();
			expect(mockAesDecryptAsync).toHaveBeenCalled();
			expect(mockFileWrite).toHaveBeenCalledWith('{"decrypted":"data"}');
		});

		it("falls back to plain text when no encryption key", async () => {
			mockLoadEncryptionKey.mockResolvedValue(null);
			mockFileText.mockResolvedValue('{"plain":"data"}');
			mockShareAsync.mockResolvedValue(undefined);

			await saveBackupData();

			expect(mockFileText).toHaveBeenCalled();
			expect(mockFileWrite).toHaveBeenCalledWith('{"plain":"data"}');
		});

		it("falls back to plain text when decryption fails", async () => {
			mockLoadEncryptionKey.mockResolvedValue("aabbccdd".repeat(8));
			mockFileBytes.mockRejectedValue(new Error("decrypt error"));
			mockFileText.mockResolvedValue('{"plain":"fallback"}');
			mockShareAsync.mockResolvedValue(undefined);

			await saveBackupData();

			expect(mockFileText).toHaveBeenCalled();
			expect(mockFileWrite).toHaveBeenCalledWith('{"plain":"fallback"}');
		});

		it("shares the temp file with correct options", async () => {
			mockLoadEncryptionKey.mockResolvedValue(null);
			mockFileText.mockResolvedValue('{"store":"data"}');
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
