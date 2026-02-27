import {
	mockMainStore,
	resetMockMainStore,
	seedMockMainStore,
} from "../../__mocks__/main-store-mock";

// Mock the store module
jest.mock("../../stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
}));

// Import the functions under test AFTER mocks
import { deleteMessage, upsertMessage } from "../../actions/message";

describe("message actions", () => {
	beforeEach(() => {
		resetMockMainStore();
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("upsertMessage", () => {
		it("creates new message with id, chatId, contents, role, createdAt, providerId, modelId, and status", () => {
			upsertMessage(
				"msg-1",
				"chat-1",
				"Hello world",
				"user",
				"whisper-ai",
				"",
				"done",
			);

			expect(mockMainStore.setRow).toHaveBeenCalledWith("messages", "msg-1", {
				id: "msg-1",
				chatId: "chat-1",
				contents: "Hello world",
				role: "user",
				createdAt: "2024-01-15T10:30:00.000Z",
				providerId: "whisper-ai",
				modelId: "",
				status: "done",
			});
		});

		it("updates existing message and preserves createdAt", () => {
			const originalCreatedAt = "2024-01-01T00:00:00.000Z";
			seedMockMainStore(
				{},
				{
					messages: {
						"msg-1": {
							id: "msg-1",
							chatId: "chat-1",
							contents: "Original message",
							role: "user",
							createdAt: originalCreatedAt,
							providerId: "whisper-ai",
							modelId: "",
							status: "done",
						},
					},
				},
			);

			upsertMessage("msg-1", "chat-1", "Updated message", "user");

			expect(mockMainStore.setRow).toHaveBeenCalledWith("messages", "msg-1", {
				id: "msg-1",
				chatId: "chat-1",
				contents: "Updated message",
				role: "user",
				createdAt: originalCreatedAt, // Should preserve original createdAt
				providerId: "whisper-ai", // Should preserve original providerId
				modelId: "", // Should preserve original modelId
				status: "done", // Should preserve original status
			});
		});

		it("assigns ISO timestamp on new message", () => {
			upsertMessage("msg-new", "chat-1", "New message", "assistant");

			const setRowCall = mockMainStore.setRow.mock.calls[0];
			const savedMessage = setRowCall[2];

			expect(savedMessage.createdAt).toBe("2024-01-15T10:30:00.000Z");
			// Verify it's a valid ISO string
			expect(new Date(savedMessage.createdAt).toISOString()).toBe(
				savedMessage.createdAt,
			);
		});

		it("can create messages with different roles", () => {
			upsertMessage("msg-user", "chat-1", "User message", "user");
			upsertMessage("msg-assistant", "chat-1", "AI response", "assistant");

			expect(mockMainStore.setRow).toHaveBeenCalledTimes(2);
			expect(mockMainStore.setRow.mock.calls[0][2].role).toBe("user");
			expect(mockMainStore.setRow.mock.calls[1][2].role).toBe("assistant");
		});

		it("defaults status to 'done' when not provided", () => {
			upsertMessage("msg-1", "chat-1", "Hello", "user", "whisper-ai", "");

			const savedMessage = mockMainStore.setRow.mock.calls[0][2];
			expect(savedMessage.status).toBe("done");
		});

		it("accepts explicit status parameter", () => {
			upsertMessage(
				"msg-1",
				"chat-1",
				"Partial...",
				"assistant",
				"whisper-ai",
				"",
				"length",
			);

			const savedMessage = mockMainStore.setRow.mock.calls[0][2];
			expect(savedMessage.status).toBe("length");
		});

		it("preserves existing status on update when not provided", () => {
			seedMockMainStore(
				{},
				{
					messages: {
						"msg-1": {
							id: "msg-1",
							chatId: "chat-1",
							contents: "Partial",
							role: "assistant",
							createdAt: "2024-01-01T00:00:00.000Z",
							providerId: "whisper-ai",
							status: "length",
						},
					},
				},
			);

			upsertMessage("msg-1", "chat-1", "Updated", "assistant");

			const savedMessage = mockMainStore.setRow.mock.calls[0][2];
			expect(savedMessage.status).toBe("length");
		});
	});

	describe("deleteMessage", () => {
		it("calls delRow with correct messageId", () => {
			deleteMessage("msg-to-delete");

			expect(mockMainStore.delRow).toHaveBeenCalledWith(
				"messages",
				"msg-to-delete",
			);
		});

		it("can delete any message by ID", () => {
			seedMockMainStore(
				{},
				{
					messages: {
						"msg-1": {
							id: "msg-1",
							chatId: "chat-1",
							contents: "Test",
							role: "user",
							createdAt: "",
						},
					},
				},
			);

			deleteMessage("msg-1");

			expect(mockMainStore.delRow).toHaveBeenCalledWith("messages", "msg-1");
		});
	});
});
