import {
	mockMainStore,
	resetMockMainStore,
	seedMockMainStore,
} from "../../__mocks__/main-store-mock";

// Mock the store module
jest.mock("../../stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
}));

// Mock uuid
jest.mock("uuid", () => ({ v4: () => "mock-uuid-1" }));

// Import the functions under test AFTER mocks
import { createFolder, renameFolder, deleteFolder } from "../../actions/folder";

describe("folder actions", () => {
	beforeEach(() => {
		resetMockMainStore();
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("createFolder", () => {
		it("creates a folder with id, name, and createdAt", () => {
			createFolder("Work");

			expect(mockMainStore.setRow).toHaveBeenCalledWith(
				"folders",
				"mock-uuid-1",
				{
					id: "mock-uuid-1",
					name: "Work",
					createdAt: "2024-01-15T10:30:00.000Z",
				},
			);
		});

		it("returns the generated folder id", () => {
			const id = createFolder("Personal");

			expect(id).toBe("mock-uuid-1");
		});

		it("creates folder with empty name", () => {
			createFolder("");

			expect(mockMainStore.setRow).toHaveBeenCalledWith(
				"folders",
				"mock-uuid-1",
				{
					id: "mock-uuid-1",
					name: "",
					createdAt: "2024-01-15T10:30:00.000Z",
				},
			);
		});
	});

	describe("renameFolder", () => {
		it("renames an existing folder", () => {
			seedMockMainStore(
				{},
				{
					folders: {
						"folder-1": {
							id: "folder-1",
							name: "Old Name",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					},
				},
			);

			renameFolder("folder-1", "New Name");

			expect(mockMainStore.setRow).toHaveBeenCalledWith(
				"folders",
				"folder-1",
				{
					id: "folder-1",
					name: "New Name",
					createdAt: "2024-01-01T00:00:00.000Z",
				},
			);
		});

		it("preserves existing folder fields when renaming", () => {
			seedMockMainStore(
				{},
				{
					folders: {
						"folder-1": {
							id: "folder-1",
							name: "Original",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					},
				},
			);

			renameFolder("folder-1", "Renamed");

			const callArgs = mockMainStore.setRow.mock.calls[0];
			expect(callArgs[2].createdAt).toBe("2024-01-01T00:00:00.000Z");
			expect(callArgs[2].id).toBe("folder-1");
		});

		it("no-op if folder does not exist", () => {
			renameFolder("non-existent-folder", "New Name");

			expect(mockMainStore.setRow).not.toHaveBeenCalled();
		});
	});

	describe("deleteFolder", () => {
		it("deletes the folder row", () => {
			seedMockMainStore(
				{},
				{
					folders: {
						"folder-1": {
							id: "folder-1",
							name: "To Delete",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					},
				},
			);

			deleteFolder("folder-1");

			expect(mockMainStore.delRow).toHaveBeenCalledWith(
				"folders",
				"folder-1",
			);
		});

		it("unfiles all chats in the folder before deleting", () => {
			seedMockMainStore(
				{},
				{
					folders: {
						"folder-1": {
							id: "folder-1",
							name: "Work",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					},
					chats: {
						"chat-1": {
							id: "chat-1",
							name: "Chat A",
							createdAt: "2024-01-01T00:00:00.000Z",
							folderId: "folder-1",
						},
						"chat-2": {
							id: "chat-2",
							name: "Chat B",
							createdAt: "2024-01-02T00:00:00.000Z",
							folderId: "folder-1",
						},
					},
				},
			);

			deleteFolder("folder-1");

			// Chats should have folderId set to ""
			expect(mockMainStore.setRow).toHaveBeenCalledWith("chats", "chat-1", {
				id: "chat-1",
				name: "Chat A",
				createdAt: "2024-01-01T00:00:00.000Z",
				folderId: "",
			});
			expect(mockMainStore.setRow).toHaveBeenCalledWith("chats", "chat-2", {
				id: "chat-2",
				name: "Chat B",
				createdAt: "2024-01-02T00:00:00.000Z",
				folderId: "",
			});
		});

		it("does not modify chats in other folders", () => {
			seedMockMainStore(
				{},
				{
					folders: {
						"folder-1": {
							id: "folder-1",
							name: "Work",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					},
					chats: {
						"chat-1": {
							id: "chat-1",
							name: "Chat in folder-1",
							createdAt: "2024-01-01T00:00:00.000Z",
							folderId: "folder-1",
						},
						"chat-other": {
							id: "chat-other",
							name: "Chat in folder-2",
							createdAt: "2024-01-02T00:00:00.000Z",
							folderId: "folder-2",
						},
						"chat-unfiled": {
							id: "chat-unfiled",
							name: "Unfiled Chat",
							createdAt: "2024-01-03T00:00:00.000Z",
							folderId: "",
						},
					},
				},
			);

			deleteFolder("folder-1");

			// Should only update chat-1, not the others
			expect(mockMainStore.setRow).toHaveBeenCalledTimes(1);
			expect(mockMainStore.setRow).toHaveBeenCalledWith("chats", "chat-1", {
				id: "chat-1",
				name: "Chat in folder-1",
				createdAt: "2024-01-01T00:00:00.000Z",
				folderId: "",
			});
		});

		it("handles deletion when no chats exist", () => {
			seedMockMainStore(
				{},
				{
					folders: {
						"folder-1": {
							id: "folder-1",
							name: "Empty Folder",
							createdAt: "2024-01-01T00:00:00.000Z",
						},
					},
				},
			);

			deleteFolder("folder-1");

			expect(mockMainStore.setRow).not.toHaveBeenCalled();
			expect(mockMainStore.delRow).toHaveBeenCalledWith(
				"folders",
				"folder-1",
			);
		});
	});
});
