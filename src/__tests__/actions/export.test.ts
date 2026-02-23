import {
	resetMockMainStore,
	seedMockMainStore,
} from "../../__mocks__/main-store-mock";

// Mock the store module
jest.mock("../../stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
}));

// Mock expo-file-system
const mockFileWrite = jest.fn().mockResolvedValue(undefined);

jest.mock("expo-file-system", () => {
	// Store constructor functions
	const Directory = jest.fn().mockImplementation(() => Object.create(null));
	const File = jest.fn().mockImplementation(() => ({
		write: mockFileWrite,
		get uri() {
			return "file:///mock/path/file.md";
		},
	}));

	return {
		__esModule: true,
		Paths: {
			cache: "file:///mock/cache/",
		},
		Directory,
		File,
	};
});

// Mock expo-sharing
jest.mock("expo-sharing", () => ({
	__esModule: true,
	shareAsync: jest.fn().mockResolvedValue({ action: "sharedAction" }),
	isAvailableAsync: jest.fn().mockResolvedValue(true),
}));

// Import the functions under test AFTER mocks
import {
	exportAllChats,
	getChatsSummary,
} from "../../actions/export";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

describe("export actions", () => {
	beforeEach(() => {
		resetMockMainStore();
		jest.clearAllMocks();
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("getChatsSummary", () => {
		it("returns zero counts when no chats exist", () => {
			const result = getChatsSummary();
			expect(result).toEqual({ chatCount: 0, messageCount: 0 });
		});

		it("returns correct counts when chats and messages exist", () => {
			seedMockMainStore(
				{},
				{
					chats: {
						"chat-1": { id: "chat-1", name: "Chat 1", createdAt: "" },
						"chat-2": { id: "chat-2", name: "Chat 2", createdAt: "" },
					},
					messages: {
						"msg-1": { id: "msg-1", chatId: "chat-1", contents: "Hi", role: "user" },
						"msg-2": { id: "msg-2", chatId: "chat-1", contents: "Hello", role: "assistant" },
						"msg-3": { id: "msg-3", chatId: "chat-2", contents: "Question", role: "user" },
					},
				},
			);

			const result = getChatsSummary();
			expect(result).toEqual({ chatCount: 2, messageCount: 3 });
		});

		it("counts messages only from existing chats", () => {
			seedMockMainStore(
				{},
				{
					chats: {
						"chat-1": { id: "chat-1", name: "Chat 1", createdAt: "" },
					},
					messages: {
						"msg-1": { id: "msg-1", chatId: "chat-1", contents: "Hi", role: "user" },
						"msg-orphan": { id: "msg-orphan", chatId: "non-existent", contents: "Orphan", role: "user" },
					},
				},
			);

			const result = getChatsSummary();
			expect(result).toEqual({ chatCount: 1, messageCount: 1 });
		});
	});

	describe("exportAllChats", () => {
		it("returns null when no chats exist", async () => {
			const result = await exportAllChats("markdown");
			expect(result).toBeNull();
			expect(FileSystem.File).not.toHaveBeenCalled();
			expect(Sharing.shareAsync).not.toHaveBeenCalled();
		});

		it("exports chats to markdown format", async () => {
			seedMockMainStore(
				{},
				{
					chats: {
						"chat-1": {
							id: "chat-1",
							name: "Test Chat",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					},
					messages: {
						"msg-1": {
							id: "msg-1",
							chatId: "chat-1",
							contents: "Hello world",
							role: "user",
							createdAt: "2024-01-01T00:01:00.000Z",
						},
						"msg-2": {
							id: "msg-2",
							chatId: "chat-1",
							contents: "Hi there!",
							role: "assistant",
							createdAt: "2024-01-01T00:02:00.000Z",
						},
					},
				},
			);

			const result = await exportAllChats("markdown");

			expect(result).toBe("file:///mock/path/file.md");
			expect(FileSystem.Directory).toHaveBeenCalledWith("file:///mock/cache/");
			expect(FileSystem.File).toHaveBeenCalled();
			expect(mockFileWrite).toHaveBeenCalled();
			expect(Sharing.shareAsync).toHaveBeenCalledWith(
				"file:///mock/path/file.md",
				{
					mimeType: "text/markdown",
					dialogTitle: "Export Whisper Chats (MARKDOWN)",
				},
			);
		});

		it("exports chats to json format", async () => {
			seedMockMainStore(
				{},
				{
					chats: {
						"chat-1": {
							id: "chat-1",
							name: "JSON Chat",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					},
					messages: {
						"msg-1": {
							id: "msg-1",
							chatId: "chat-1",
							contents: "Test message",
							role: "user",
							createdAt: "2024-01-01T00:01:00.000Z",
						},
					},
				},
			);

			await exportAllChats("json");

			expect(Sharing.shareAsync).toHaveBeenCalledWith(
				"file:///mock/path/file.md",
				{
					mimeType: "application/json",
					dialogTitle: "Export Whisper Chats (JSON)",
				},
			);
		});

		it("exports multiple chats sorted by creation date", async () => {
			seedMockMainStore(
				{},
				{
					chats: {
						"chat-newer": {
							id: "chat-newer",
							name: "Newer Chat",
							createdAt: "2024-02-01T00:00:00.000Z",
						},
						"chat-older": {
							id: "chat-older",
							name: "Older Chat",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					},
					messages: {},
				},
			);

			await exportAllChats("markdown");

			// Verify write was called (content should have older chat first)
			expect(mockFileWrite).toHaveBeenCalled();
			const writtenContent = mockFileWrite.mock.calls[0][0];
			expect(writtenContent).toContain("Older Chat");
			expect(writtenContent).toContain("Newer Chat");
			// Older should appear before Newer in the content
			const olderIndex = writtenContent.indexOf("Older Chat");
			const newerIndex = writtenContent.indexOf("Newer Chat");
			expect(olderIndex).toBeLessThan(newerIndex);
		});

		it("handles chat with no messages", async () => {
			seedMockMainStore(
				{},
				{
					chats: {
						"chat-empty": {
							id: "chat-empty",
							name: "Empty Chat",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					},
					messages: {},
				},
			);

			await exportAllChats("markdown");

			expect(mockFileWrite).toHaveBeenCalled();
			const writtenContent = mockFileWrite.mock.calls[0][0];
			expect(writtenContent).toContain("Empty Chat");
			expect(writtenContent).toContain("*No messages*");
		});

		it("sanitizes chat names in markdown export", async () => {
			seedMockMainStore(
				{},
				{
					chats: {
						"chat-1": {
							id: "chat-1",
							name: "Chat with #special & chars!",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					},
					messages: {},
				},
			);

			await exportAllChats("markdown");

			const writtenContent = mockFileWrite.mock.calls[0][0];
			// Should remove special chars but keep spaces (#special & chars! -> special  chars - double space)
			// Note: the content starts with "# Whisper AI" so we check for the chat name specifically
			expect(writtenContent).toContain("## Chat with special  chars");
		});

		it("returns file URI if sharing is not available", async () => {
			// Override the mock for this test
			(Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

			seedMockMainStore(
				{},
				{
					chats: {
						"chat-1": { id: "chat-1", name: "Test", createdAt: "" },
					},
					messages: {},
				},
			);

			const result = await exportAllChats("markdown");

			expect(result).toBe("file:///mock/path/file.md");
			expect(Sharing.shareAsync).not.toHaveBeenCalled();
		});

		it("uses markdown as default format", async () => {
			seedMockMainStore(
				{},
				{
					chats: {
						"chat-1": { id: "chat-1", name: "Test", createdAt: "" },
					},
					messages: {},
				},
			);

			// Call without format argument
			await exportAllChats();

			expect(Sharing.shareAsync).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					mimeType: "text/markdown",
				}),
			);
		});
	});
});
