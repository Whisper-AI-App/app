// Mock the store module before imports
jest.mock("../../stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
}));

import {
	mockMainStore,
	resetMockMainStore,
	seedMockMainStore,
} from "../../__mocks__/main-store-mock";
import { generateAltText, enrichAltText } from "../../utils/alt-text";
import type { PendingAttachment } from "../../ai-providers/types";

describe("alt-text utils", () => {
	beforeEach(() => {
		resetMockMainStore();
	});

	describe("generateAltText", () => {
		it("generates image alt from dimensions and format", () => {
			const attachment: PendingAttachment = {
				id: "att-1",
				type: "image",
				uri: "file:///photo.jpg",
				mimeType: "image/jpeg",
				fileName: "photo.jpg",
				fileSize: 500000,
				width: 1200,
				height: 800,
			};
			const alt = generateAltText(attachment);
			expect(alt).toContain("Image:");
			expect(alt).toContain("1200\u00D7800");
			expect(alt).toContain("JPEG");
			expect(alt).toContain("488.3KB");
		});

		it("generates audio alt from duration and format", () => {
			const attachment: PendingAttachment = {
				id: "att-2",
				type: "audio",
				uri: "file:///audio.wav",
				mimeType: "audio/wav",
				fileName: "recording.wav",
				fileSize: 320000,
				duration: 15,
			};
			const alt = generateAltText(attachment);
			expect(alt).toContain("Audio recording:");
			expect(alt).toContain("15s");
			expect(alt).toContain("WAV");
		});

		it("generates audio alt with minutes for longer recordings", () => {
			const attachment: PendingAttachment = {
				id: "att-3",
				type: "audio",
				uri: "file:///long.wav",
				mimeType: "audio/wav",
				fileName: "long.wav",
				fileSize: 1000000,
				duration: 90,
			};
			const alt = generateAltText(attachment);
			expect(alt).toContain("1m 30s");
		});

		it("generates file alt from name, size, and type", () => {
			const attachment: PendingAttachment = {
				id: "att-4",
				type: "file",
				uri: "file:///notes.txt",
				mimeType: "text/plain",
				fileName: "notes.txt",
				fileSize: 2048,
			};
			const alt = generateAltText(attachment);
			expect(alt).toContain("File:");
			expect(alt).toContain("notes.txt");
			expect(alt).toContain("2.0KB");
			expect(alt).toContain("PLAIN");
		});

		it("generates file alt for PDF", () => {
			const attachment: PendingAttachment = {
				id: "att-5",
				type: "file",
				uri: "file:///report.pdf",
				mimeType: "application/pdf",
				fileName: "report.pdf",
				fileSize: 5 * 1024 * 1024,
			};
			const alt = generateAltText(attachment);
			expect(alt).toContain("File:");
			expect(alt).toContain("report.pdf");
			expect(alt).toContain("5.0MB");
		});

		it("handles image without dimensions", () => {
			const attachment: PendingAttachment = {
				id: "att-6",
				type: "image",
				uri: "file:///photo.png",
				mimeType: "image/png",
				fileName: "photo.png",
				fileSize: 100000,
			};
			const alt = generateAltText(attachment);
			expect(alt).toContain("Image:");
			expect(alt).toContain("PNG");
			// Should not contain dimensions
			expect(alt).not.toContain("\u00D7");
		});
	});

	describe("enrichAltText", () => {
		it("updates stored alt text for existing attachment", () => {
			seedMockMainStore(
				{},
				{
					attachments: {
						"att-1": {
							id: "att-1",
							messageId: "msg-1",
							type: "image",
							alt: "Image: 800x600 JPEG",
						},
					},
				},
			);

			enrichAltText("att-1", "A golden retriever sitting on a couch");

			expect(mockMainStore.setCell).toHaveBeenCalledWith(
				"attachments",
				"att-1",
				"alt",
				"A golden retriever sitting on a couch",
			);
		});

		it("does not update with empty description", () => {
			seedMockMainStore(
				{},
				{
					attachments: {
						"att-1": {
							id: "att-1",
							messageId: "msg-1",
							type: "image",
							alt: "Image: 800x600 JPEG",
						},
					},
				},
			);

			enrichAltText("att-1", "   ");
			expect(mockMainStore.setCell).not.toHaveBeenCalled();
		});
	});
});
