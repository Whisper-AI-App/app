import {
	mockMainStore,
	resetMockMainStore,
	seedMockMainStore,
} from "../../__mocks__/main-store-mock";

// Mock expo-file-system first (before store mock)
const mockFileDelete = jest.fn();
let mockFileExists = true;

jest.mock("expo-file-system", () => ({
	File: jest.fn().mockImplementation(() => ({
		get exists() {
			return mockFileExists;
		},
		delete: mockFileDelete,
	})),
	Directory: jest.fn().mockImplementation(() => ({
		uri: "file:///mock/documents",
	})),
	Paths: { document: "file:///mock/documents" },
}));

// Mock initMainStore and getModelFileUri functions
const mockInitMainStore = jest.fn();
let mockModelFileUri: string | undefined;

// Mock the store module with all exports
jest.mock("../../stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
	initMainStore: () => mockInitMainStore(),
	getModelFileUri: () => mockModelFileUri,
}));

// Import the functions under test AFTER mocks
import { clearConversations, resetEverything } from "../../actions/reset";

describe("reset actions", () => {
	beforeEach(() => {
		resetMockMainStore();
		mockInitMainStore.mockReset();
		mockFileDelete.mockReset();
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

			expect(mockFileDelete).toHaveBeenCalled();
		});

		it("skips file deletion when no model file uri", async () => {
			mockModelFileUri = undefined;

			await resetEverything();

			expect(mockFileDelete).not.toHaveBeenCalled();
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

		it("calls initMainStore to reinitialize", async () => {
			mockModelFileUri = undefined;

			await resetEverything();

			expect(mockInitMainStore).toHaveBeenCalled();
		});
	});
});
