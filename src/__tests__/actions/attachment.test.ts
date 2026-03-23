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
const mockFileExists = jest.fn(() => true);
const mockFileCopy = jest.fn();
const mockFileSize = 1024;
const mockDirExists = jest.fn(() => false);
const mockDirCreate = jest.fn();
const mockDirDelete = jest.fn();

jest.mock("expo-file-system", () => ({
	File: jest.fn().mockImplementation((uri: string) => ({
		uri,
		exists: mockFileExists(),
		size: mockFileSize,
		copy: mockFileCopy,
	})),
	Directory: jest.fn().mockImplementation((uri: string) => ({
		uri,
		get exists() {
			return mockDirExists();
		},
		create: mockDirCreate,
		delete: mockDirDelete,
	})),
	Paths: {
		document: "/mock/documents",
	},
}));

// Import after mocks
import {
	saveAttachments,
	getAttachmentsByMessage,
	deleteAttachmentsByMessage,
} from "../../actions/attachment";
import type { ProcessedAttachment } from "../../ai-providers/types";

describe("attachment actions", () => {
	beforeEach(() => {
		resetMockMainStore();
		jest.clearAllMocks();
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2024-06-01T12:00:00.000Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("saveAttachments", () => {
		it("saves multiple attachments to TinyBase", async () => {
			const processed: ProcessedAttachment[] = [
				{
					id: "att-1",
					type: "image",
					uri: "file:///tmp/img1.jpg",
					mimeType: "image/jpeg",
					fileName: "photo.jpg",
					fileSize: 500000,
					width: 800,
					height: 600,
					duration: 0,
					alt: "Image: 800x600 JPEG",
					thumbnailUri: "file:///tmp/img1_thumb.jpg",
				},
				{
					id: "att-2",
					type: "file",
					uri: "file:///tmp/doc.txt",
					mimeType: "text/plain",
					fileName: "notes.txt",
					fileSize: 1024,
					width: 0,
					height: 0,
					duration: 0,
					alt: "File: notes.txt (1.0KB, TXT)",
					thumbnailUri: "",
				},
			];

			await saveAttachments("msg-1", processed);

			expect(mockMainStore.setRow).toHaveBeenCalledTimes(2);
			expect(mockMainStore.setRow).toHaveBeenCalledWith(
				"attachments",
				"att-1",
				expect.objectContaining({
					id: "att-1",
					messageId: "msg-1",
					type: "image",
					mimeType: "image/jpeg",
				}),
			);
			expect(mockMainStore.setRow).toHaveBeenCalledWith(
				"attachments",
				"att-2",
				expect.objectContaining({
					id: "att-2",
					messageId: "msg-1",
					type: "file",
				}),
			);
		});

		it("skips empty array", async () => {
			await saveAttachments("msg-1", []);
			expect(mockMainStore.setRow).not.toHaveBeenCalled();
		});
	});

	describe("getAttachmentsByMessage", () => {
		it("returns attachments for a specific messageId", () => {
			seedMockMainStore(
				{},
				{
					attachments: {
						"att-1": {
							id: "att-1",
							messageId: "msg-1",
							type: "image",
							uri: "file:///path/img.jpg",
							mimeType: "image/jpeg",
							fileName: "photo.jpg",
							fileSize: 500000,
							width: 800,
							height: 600,
							duration: 0,
							alt: "Image",
							thumbnailUri: "",
							createdAt: "2024-06-01T12:00:00.000Z",
						},
						"att-2": {
							id: "att-2",
							messageId: "msg-2",
							type: "file",
							uri: "file:///path/doc.txt",
							mimeType: "text/plain",
							fileName: "doc.txt",
							fileSize: 100,
							width: 0,
							height: 0,
							duration: 0,
							alt: "File",
							thumbnailUri: "",
							createdAt: "2024-06-01T12:00:00.000Z",
						},
						"att-3": {
							id: "att-3",
							messageId: "msg-1",
							type: "audio",
							uri: "file:///path/audio.wav",
							mimeType: "audio/wav",
							fileName: "recording.wav",
							fileSize: 200000,
							width: 0,
							height: 0,
							duration: 15,
							alt: "Audio",
							thumbnailUri: "",
							createdAt: "2024-06-01T12:01:00.000Z",
						},
					},
				},
			);

			const result = getAttachmentsByMessage("msg-1");
			expect(result).toHaveLength(2);
			expect(result[0].id).toBe("att-1");
			expect(result[1].id).toBe("att-3");
		});

		it("returns empty array when no attachments match", () => {
			const result = getAttachmentsByMessage("nonexistent");
			expect(result).toHaveLength(0);
		});
	});

	describe("deleteAttachmentsByMessage", () => {
		it("deletes TinyBase rows for matching attachments", async () => {
			seedMockMainStore(
				{},
				{
					attachments: {
						"att-1": {
							id: "att-1",
							messageId: "msg-1",
							type: "image",
							uri: "file:///path/img.jpg",
							mimeType: "image/jpeg",
							fileName: "photo.jpg",
							fileSize: 500000,
							width: 800,
							height: 600,
							duration: 0,
							alt: "Image",
							thumbnailUri: "",
							createdAt: "2024-06-01T12:00:00.000Z",
						},
					},
				},
			);

			await deleteAttachmentsByMessage("msg-1");
			expect(mockMainStore.delRow).toHaveBeenCalledWith("attachments", "att-1");
		});

		it("attempts filesystem directory deletion", async () => {
			mockDirExists.mockReturnValue(true);

			seedMockMainStore(
				{},
				{
					attachments: {
						"att-1": {
							id: "att-1",
							messageId: "msg-1",
							type: "image",
							uri: "file:///path/img.jpg",
							mimeType: "image/jpeg",
							fileName: "photo.jpg",
							fileSize: 500000,
							width: 800,
							height: 600,
							duration: 0,
							alt: "Image",
							thumbnailUri: "",
							createdAt: "2024-06-01T12:00:00.000Z",
						},
					},
				},
			);

			await deleteAttachmentsByMessage("msg-1");
			expect(mockDirDelete).toHaveBeenCalled();
		});
	});
});
