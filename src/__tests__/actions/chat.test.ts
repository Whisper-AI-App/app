import {
	mockMainStore,
	resetMockMainStore,
	seedMockMainStore,
} from "../../__mocks__/main-store-mock";

// Mock the store module
jest.mock("../../stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
}));

// Mock react-native Share separately
const mockShare = jest.fn().mockResolvedValue({ action: "sharedAction" });
jest.mock("react-native/Libraries/Share/Share", () => ({
	__esModule: true,
	default: {
		share: (...args: unknown[]) => mockShare(...args),
		sharedAction: "sharedAction",
		dismissedAction: "dismissedAction",
	},
}));

// Import the functions under test AFTER mocks
import {
	deleteChat,
	renameChat,
	shareChat,
	upsertChat,
} from "../../actions/chat";

describe("chat actions", () => {
	beforeEach(() => {
		resetMockMainStore();
		mockShare.mockClear();
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("upsertChat", () => {
		it("creates new chat with id, name, and createdAt", () => {
			upsertChat("chat-1", "My First Chat");

			expect(mockMainStore.setRow).toHaveBeenCalledWith("chats", "chat-1", {
				id: "chat-1",
				name: "My First Chat",
				createdAt: "2024-01-15T10:30:00.000Z",
			});
		});

		it("updates existing chat and preserves createdAt", () => {
			const originalCreatedAt = "2024-01-01T00:00:00.000Z";
			seedMockMainStore(
				{},
				{
					chats: {
						"chat-1": {
							id: "chat-1",
							name: "Original Name",
							createdAt: originalCreatedAt,
						},
					},
				},
			);

			upsertChat("chat-1", "Updated Name");

			expect(mockMainStore.setRow).toHaveBeenCalledWith("chats", "chat-1", {
				id: "chat-1",
				name: "Updated Name",
				createdAt: originalCreatedAt, // Should preserve original createdAt
			});
		});
	});

	describe("deleteChat", () => {
		it("removes chat row", () => {
			deleteChat("chat-to-delete");

			expect(mockMainStore.delRow).toHaveBeenCalledWith(
				"chats",
				"chat-to-delete",
			);
		});

		it("cascades deletion to messages with matching chatId", () => {
			seedMockMainStore(
				{},
				{
					messages: {
						"msg-1": {
							id: "msg-1",
							chatId: "chat-1",
							contents: "Message 1",
							role: "user",
							createdAt: "",
						},
						"msg-2": {
							id: "msg-2",
							chatId: "chat-1",
							contents: "Message 2",
							role: "assistant",
							createdAt: "",
						},
						"msg-3": {
							id: "msg-3",
							chatId: "chat-2",
							contents: "Other chat message",
							role: "user",
							createdAt: "",
						},
					},
				},
			);

			deleteChat("chat-1");

			// Should delete the chat
			expect(mockMainStore.delRow).toHaveBeenCalledWith("chats", "chat-1");
			// Should delete messages belonging to chat-1
			expect(mockMainStore.delRow).toHaveBeenCalledWith("messages", "msg-1");
			expect(mockMainStore.delRow).toHaveBeenCalledWith("messages", "msg-2");
		});

		it("preserves messages from other chats", () => {
			seedMockMainStore(
				{},
				{
					messages: {
						"msg-1": {
							id: "msg-1",
							chatId: "chat-1",
							contents: "Message 1",
							role: "user",
							createdAt: "",
						},
						"msg-other": {
							id: "msg-other",
							chatId: "chat-2",
							contents: "Other chat",
							role: "user",
							createdAt: "",
						},
					},
				},
			);

			deleteChat("chat-1");

			// Should NOT delete message from chat-2
			expect(mockMainStore.delRow).not.toHaveBeenCalledWith(
				"messages",
				"msg-other",
			);
		});
	});

	describe("renameChat", () => {
		it("updates name field", () => {
			seedMockMainStore(
				{},
				{
					chats: {
						"chat-1": {
							id: "chat-1",
							name: "Original Name",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					},
				},
			);

			renameChat("chat-1", "New Name");

			expect(mockMainStore.setRow).toHaveBeenCalledWith("chats", "chat-1", {
				id: "chat-1",
				name: "New Name",
				createdAt: "2024-01-01T00:00:00.000Z",
			});
		});

		it("no-op if chat does not exist", () => {
			// No chats seeded
			renameChat("non-existent-chat", "New Name");

			expect(mockMainStore.setRow).not.toHaveBeenCalled();
		});
	});

	describe("shareChat", () => {
		it("formats messages and calls Share.share", async () => {
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
							contents: "Hello",
							role: "user",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
						"msg-2": {
							id: "msg-2",
							chatId: "chat-1",
							contents: "Hi there!",
							role: "assistant",
							createdAt: "2024-01-01T00:01:00.000Z",
						},
					},
				},
			);

			await shareChat("chat-1");

			expect(mockShare).toHaveBeenCalledTimes(1);
			const shareArg = mockShare.mock.calls[0][0];
			expect(shareArg.message).toContain("Test Chat");
			expect(shareArg.message).toContain("Me:");
			expect(shareArg.message).toContain("Hello");
			expect(shareArg.message).toContain("Whisper AI");
			expect(shareArg.message).toContain("Hi there!");
			expect(shareArg.message).toContain("https://usewhisper.org");
		});

		it("returns early if chat does not exist", async () => {
			// No chats seeded

			await shareChat("non-existent-chat");

			expect(mockShare).not.toHaveBeenCalled();
		});

		it("sorts messages by createdAt ascending", async () => {
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
						"msg-later": {
							id: "msg-later",
							chatId: "chat-1",
							contents: "Second message",
							role: "user",
							createdAt: "2024-01-01T00:02:00.000Z",
						},
						"msg-first": {
							id: "msg-first",
							chatId: "chat-1",
							contents: "First message",
							role: "user",
							createdAt: "2024-01-01T00:01:00.000Z",
						},
					},
				},
			);

			await shareChat("chat-1");

			const shareArg = mockShare.mock.calls[0][0];
			const firstIndex = shareArg.message.indexOf("First message");
			const secondIndex = shareArg.message.indexOf("Second message");
			expect(firstIndex).toBeLessThan(secondIndex);
		});
	});
});
