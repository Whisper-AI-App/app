// Mock expo-image-manipulator — define everything inside the factory to avoid
// Jest hoisting issues with const declarations
jest.mock("expo-image-manipulator", () => {
	const saveAsync = jest.fn().mockResolvedValue({
		uri: "file:///processed/image.jpg",
		width: 800,
		height: 600,
	});
	const renderAsync = jest.fn().mockResolvedValue({
		saveAsync,
	});
	const resize = jest.fn().mockReturnValue({
		renderAsync,
	});
	const manipulate = jest.fn().mockReturnValue({
		resize,
	});
	return {
		__esModule: true,
		ImageManipulator: { manipulate },
		SaveFormat: { JPEG: "jpeg" },
		// Expose refs for test assertions
		__mocks: { manipulate, resize, renderAsync, saveAsync },
	};
});

// Mock expo-file-system
jest.mock("expo-file-system", () => ({
	File: jest.fn().mockImplementation((uri: string) => ({
		uri,
		exists: true,
		size: 500000,
		text: jest.fn().mockReturnValue("Sample file content for preview"),
	})),
	Directory: jest.fn().mockImplementation(() => ({
		exists: false,
		create: jest.fn(),
	})),
	Paths: {
		document: "/mock/documents",
	},
}));

// Mock uuid
jest.mock("uuid", () => ({
	v4: jest.fn().mockReturnValue("mock-uuid"),
}));

// Mock the store module
jest.mock("../../stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
}));

import { defaultPreprocessMedia } from "../../ai-providers/media-preprocessor";
import type {
	PendingAttachment,
	MultimodalCapabilities,
} from "../../ai-providers/types";
import { DEFAULT_CONSTRAINTS } from "../../ai-providers/types";

// Get mock references from the mocked module
const { __mocks } = require("expo-image-manipulator");
const mockResize = __mocks.resize;
const mockSaveAsync = __mocks.saveAsync;

const defaultCaps: MultimodalCapabilities = {
	vision: true,
	audio: true,
	files: true,
	constraints: DEFAULT_CONSTRAINTS,
};

describe("media-preprocessor", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Re-setup mock chain after clearAllMocks
		__mocks.saveAsync.mockResolvedValue({
			uri: "file:///processed/image.jpg",
			width: 800,
			height: 600,
		});
		__mocks.renderAsync.mockResolvedValue({
			saveAsync: __mocks.saveAsync,
		});
		__mocks.resize.mockReturnValue({
			renderAsync: __mocks.renderAsync,
		});
		__mocks.manipulate.mockReturnValue({
			resize: __mocks.resize,
		});
	});

	describe("image preprocessing", () => {
		it("resizes image to provider maxWidth/maxHeight", async () => {
			const attachment: PendingAttachment = {
				id: "img-1",
				type: "image",
				uri: "file:///original/photo.jpg",
				mimeType: "image/jpeg",
				fileName: "photo.jpg",
				fileSize: 3000000,
				width: 4000,
				height: 3000,
			};

			const results = await defaultPreprocessMedia([attachment], defaultCaps);

			expect(results).toHaveLength(1);
			expect(results[0].type).toBe("image");
			expect(results[0].mimeType).toBe("image/jpeg");
			expect(results[0].alt).toContain("Image:");
			expect(mockResize).toHaveBeenCalledWith({
				width: 1024,
				height: 1024,
			});
		});

		it("generates thumbnail at 150x150", async () => {
			const attachment: PendingAttachment = {
				id: "img-2",
				type: "image",
				uri: "file:///original/photo.jpg",
				mimeType: "image/jpeg",
				fileName: "photo.jpg",
				fileSize: 1000000,
				width: 800,
				height: 600,
			};

			const results = await defaultPreprocessMedia([attachment], defaultCaps);

			expect(results[0].thumbnailUri).toBeTruthy();
			// Should have called resize twice: once for image, once for thumbnail
			expect(mockResize).toHaveBeenCalledTimes(2);
			expect(mockResize).toHaveBeenCalledWith({ width: 150, height: 150 });
		});

		it("compresses to JPEG format", async () => {
			const attachment: PendingAttachment = {
				id: "img-3",
				type: "image",
				uri: "file:///original/photo.png",
				mimeType: "image/png",
				fileName: "photo.png",
				fileSize: 2000000,
				width: 1920,
				height: 1080,
			};

			const results = await defaultPreprocessMedia([attachment], defaultCaps);

			expect(results[0].mimeType).toBe("image/jpeg");
			expect(mockSaveAsync).toHaveBeenCalledWith(
				expect.objectContaining({
					format: "jpeg",
					compress: 0.8,
				}),
			);
		});
	});

	describe("file preprocessing", () => {
		it("rejects files exceeding size limit", async () => {
			const attachment: PendingAttachment = {
				id: "file-1",
				type: "file",
				uri: "file:///huge-file.bin",
				mimeType: "application/octet-stream",
				fileName: "huge-file.bin",
				fileSize: 20 * 1024 * 1024, // 20MB > 10MB limit
			};

			await expect(
				defaultPreprocessMedia([attachment], defaultCaps),
			).rejects.toThrow("File exceeds size limit");
		});

		it("rejects unsupported file types", async () => {
			const attachment: PendingAttachment = {
				id: "file-2",
				type: "file",
				uri: "file:///program.exe",
				mimeType: "application/octet-stream",
				fileName: "program.exe",
				fileSize: 1000,
			};

			await expect(
				defaultPreprocessMedia([attachment], defaultCaps),
			).rejects.toThrow("Unsupported file type");
		});

		it("processes valid text file with alt text", async () => {
			const attachment: PendingAttachment = {
				id: "file-3",
				type: "file",
				uri: "file:///notes.txt",
				mimeType: "text/plain",
				fileName: "notes.txt",
				fileSize: 512,
			};

			const results = await defaultPreprocessMedia([attachment], defaultCaps);

			expect(results).toHaveLength(1);
			expect(results[0].type).toBe("file");
			expect(results[0].alt).toContain("File:");
			expect(results[0].alt).toContain("notes.txt");
		});
	});

	describe("audio preprocessing", () => {
		it("processes audio attachment with alt text", async () => {
			const attachment: PendingAttachment = {
				id: "audio-1",
				type: "audio",
				uri: "file:///recording.wav",
				mimeType: "audio/wav",
				fileName: "recording.wav",
				fileSize: 320000,
				duration: 10,
			};

			const results = await defaultPreprocessMedia([attachment], defaultCaps);

			expect(results).toHaveLength(1);
			expect(results[0].type).toBe("audio");
			expect(results[0].duration).toBe(10);
			expect(results[0].alt).toContain("Audio recording:");
		});
	});

	describe("mixed attachments", () => {
		it("processes multiple attachment types", async () => {
			const attachments: PendingAttachment[] = [
				{
					id: "img-1",
					type: "image",
					uri: "file:///photo.jpg",
					mimeType: "image/jpeg",
					fileName: "photo.jpg",
					fileSize: 500000,
					width: 800,
					height: 600,
				},
				{
					id: "file-1",
					type: "file",
					uri: "file:///notes.txt",
					mimeType: "text/plain",
					fileName: "notes.txt",
					fileSize: 256,
				},
			];

			const results = await defaultPreprocessMedia(attachments, defaultCaps);

			expect(results).toHaveLength(2);
			expect(results[0].type).toBe("image");
			expect(results[1].type).toBe("file");
		});
	});
});
