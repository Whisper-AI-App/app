// Mock whisper-stt module
const mockInit = jest.fn();
const mockTranscribe = jest.fn();
const mockRelease = jest.fn();

jest.mock("../../stt/whisper-stt", () => ({
	initWhisper: (...args: unknown[]) => mockInit(...args),
	transcribe: (...args: unknown[]) => mockTranscribe(...args),
	release: (...args: unknown[]) => mockRelease(...args),
}));

// Mock expo-asset
jest.mock("expo-asset", () => ({
	Asset: {
		loadAsync: jest.fn().mockResolvedValue([
			{ localUri: "/local/path/ggml-base.bin" },
		]),
	},
}));

// Mock budget checker — always allow loading in these tests
jest.mock("../../memory/budget", () => ({
	checkBudget: jest.fn().mockResolvedValue({
		canLoad: true,
		availableBytes: 4 * 1024 * 1024 * 1024,
		estimatedModelBytes: 200 * 1024 * 1024,
		source: "native",
	}),
	getDeviceTierStrategy: jest.fn().mockReturnValue({ releaseSTTAfterUse: false }),
}));

// Mock state machine
jest.mock("../../memory/state", () => ({
	dispatch: jest.fn().mockReturnValue("loading"),
	getCapabilityStatus: jest.fn().mockReturnValue("unloaded"),
}));

// Import after mocks
import { initSTT, isAvailable, getTranscription, releaseSTT, getSTTStatus } from "../../stt";

describe("STT service", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockInit.mockResolvedValue(42); // returns contextId
		mockTranscribe.mockResolvedValue("transcribed text");
		mockRelease.mockResolvedValue(undefined);
	});

	describe("initSTT", () => {
		it("should load whisper model from bundled asset and initialize", async () => {
			await initSTT();

			expect(mockInit).toHaveBeenCalledWith("/local/path/ggml-base.bin");
			expect(isAvailable()).toBe(true);
			expect(getSTTStatus()).toBe("ready");
		});

		it("should be idempotent - subsequent calls are no-ops", async () => {
			// Already initialized from previous test
			await initSTT();

			expect(mockInit).not.toHaveBeenCalled();
		});
	});

	describe("getTranscription", () => {
		it("should transcribe audio file and return text", async () => {
			const result = await getTranscription("/path/to/audio.wav");

			expect(result).toBe("transcribed text");
			expect(mockTranscribe).toHaveBeenCalledWith(42, expect.any(Number), "/path/to/audio.wav");
		});
	});

	describe("releaseSTT", () => {
		it("should release context and update status to released", async () => {
			await releaseSTT();

			expect(mockRelease).toHaveBeenCalledWith(42);
			expect(getSTTStatus()).toBe("released");
			expect(isAvailable()).toBe(false);
		});
	});

	describe("reload after release", () => {
		it("should re-initialize on demand after release", async () => {
			mockInit.mockResolvedValue(99); // new contextId

			// Calling getTranscription should trigger lazy re-init
			await getTranscription("/path/to/audio.wav");

			expect(mockInit).toHaveBeenCalledWith("/local/path/ggml-base.bin");
			expect(mockTranscribe).toHaveBeenCalledWith(99, expect.any(Number), "/path/to/audio.wav");
		});
	});
});
