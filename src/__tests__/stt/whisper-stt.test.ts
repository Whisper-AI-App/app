import { initWhisper as rnInitWhisper } from "whisper.rn";
import { initWhisper, transcribe, release } from "../../stt/whisper-stt";

// Auto-mock from __mocks__/whisper.rn.ts is used automatically
const mockInitWhisper = rnInitWhisper as jest.MockedFunction<typeof rnInitWhisper>;

describe("whisper-stt", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe("initWhisper", () => {
		it("should initialize whisper context and return contextId", async () => {
			const contextId = await initWhisper("/path/to/ggml-tiny.bin");

			expect(mockInitWhisper).toHaveBeenCalledWith({
				filePath: "/path/to/ggml-tiny.bin",
				isBundleAsset: false,
				useFlashAttn: false,
				useGpu: true,
			});
			expect(contextId).toBe(1);
		});
	});

	describe("transcribe", () => {
		it("should transcribe audio file and return text", async () => {
			const contextId = await initWhisper("/path/to/model.bin");
			const result = await transcribe(contextId, 1, "/path/to/audio.wav");

			expect(result).toBe("Hello world");
		});

		it("should return empty string when transcription is aborted", async () => {
			const contextId = await initWhisper("/path/to/model.bin");

			// Override transcribe mock to return aborted result
			const mockCtx = (await mockInitWhisper.mock.results[0].value);
			mockCtx.transcribe = jest.fn().mockReturnValue({
				stop: jest.fn(),
				promise: Promise.resolve({
					result: "",
					isAborted: true,
				}),
			});

			const result = await transcribe(contextId, 2, "/path/to/audio.wav");
			expect(result).toBe("");
		});
	});

	describe("release", () => {
		it("should release whisper context", async () => {
			const contextId = await initWhisper("/path/to/model.bin");
			const mockCtx = await mockInitWhisper.mock.results[0].value;

			await release(contextId);

			expect(mockCtx.release).toHaveBeenCalled();
		});

		it("should not throw on release errors", async () => {
			const contextId = await initWhisper("/path/to/model.bin");
			const mockCtx = await mockInitWhisper.mock.results[0].value;
			mockCtx.release.mockRejectedValueOnce(new Error("already released"));

			// Should not throw
			await release(contextId);
		});
	});
});
