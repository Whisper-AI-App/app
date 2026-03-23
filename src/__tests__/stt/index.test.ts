import { getTranscription, initSTT, releaseSTT, getSTTStatus, isAvailable } from "../../stt";

// Mock whisper-stt
jest.mock("../../stt/whisper-stt", () => ({
	initWhisper: jest.fn().mockResolvedValue(1),
	transcribe: jest.fn().mockResolvedValue("hello world"),
	release: jest.fn().mockResolvedValue(undefined),
}));

// Mock expo-asset
jest.mock("expo-asset", () => ({
	Asset: {
		loadAsync: jest.fn().mockResolvedValue([{ localUri: "/mock/whisper.bin" }]),
	},
}));

// Mock budget checker
const mockCheckBudget = jest.fn();
const mockGetDeviceTierStrategy = jest.fn();
jest.mock("../../memory/budget", () => ({
	checkBudget: (...args: unknown[]) => mockCheckBudget(...args),
	getDeviceTierStrategy: (...args: unknown[]) => mockGetDeviceTierStrategy(...args),
}));

// Mock state machine
const mockDispatch = jest.fn().mockReturnValue("loading");
const mockGetCapabilityStatus = jest.fn().mockReturnValue("unloaded");
jest.mock("../../memory/state", () => ({
	dispatch: (...args: unknown[]) => mockDispatch(...args),
	getCapabilityStatus: (...args: unknown[]) => mockGetCapabilityStatus(...args),
}));

describe("STT Service", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		// Default: budget passes
		mockCheckBudget.mockResolvedValue({
			canLoad: true,
			availableBytes: 4 * 1024 * 1024 * 1024,
			estimatedModelBytes: 200 * 1024 * 1024,
			source: "native",
		});
		mockGetCapabilityStatus.mockReturnValue("unloaded");
		// Default: don't release STT after use (high-memory tier behavior)
		mockGetDeviceTierStrategy.mockReturnValue({ releaseSTTAfterUse: false });
	});

	describe("initSTT", () => {
		it("performs budget check before loading", async () => {
			await initSTT();
			expect(mockCheckBudget).toHaveBeenCalledWith(0.075, 0);
		});

		it("throws when budget is denied", async () => {
			// Release first so initSTT actually attempts loading
			await releaseSTT();

			mockCheckBudget.mockResolvedValue({
				canLoad: false,
				availableBytes: 100 * 1024 * 1024,
				estimatedModelBytes: 200 * 1024 * 1024,
				source: "native",
			});

			await expect(initSTT()).rejects.toThrow("Not enough memory");
			expect(getSTTStatus()).toBe("uninitialized");
		});

		it("succeeds when budget passes", async () => {
			await initSTT();
			expect(getSTTStatus()).toBe("ready");
			expect(isAvailable()).toBe(true);
		});
	});

	describe("getTranscription", () => {
		it("triggers lazy init with budget check if not initialized", async () => {
			// Ensure released state
			await initSTT();
			await releaseSTT();
			expect(getSTTStatus()).toBe("released");

			// getTranscription should trigger lazy init
			const text = await getTranscription("/mock/audio.wav");
			expect(text).toBe("hello world");
			expect(mockCheckBudget).toHaveBeenCalled();
		});

		it("dispatches state machine events on lazy init", async () => {
			await releaseSTT();
			mockGetCapabilityStatus.mockReturnValue("unloaded");

			await getTranscription("/mock/audio.wav");

			// Should have dispatched USER_REQUEST
			expect(mockDispatch).toHaveBeenCalledWith("stt", { type: "USER_REQUEST" });
			// Should have dispatched LOAD_SUCCESS
			expect(mockDispatch).toHaveBeenCalledWith("stt", { type: "LOAD_SUCCESS" });
		});

		it("dispatches RETRY when status is budget_denied", async () => {
			await releaseSTT();
			mockGetCapabilityStatus.mockReturnValue("budget_denied");

			await getTranscription("/mock/audio.wav");

			expect(mockDispatch).toHaveBeenCalledWith("stt", { type: "RETRY" });
		});

		it("dispatches LOAD_FAIL_BUDGET when budget denied during lazy init", async () => {
			await releaseSTT();
			mockGetCapabilityStatus.mockReturnValue("unloaded");
			mockCheckBudget.mockResolvedValue({
				canLoad: false,
				availableBytes: 50 * 1024 * 1024,
				estimatedModelBytes: 200 * 1024 * 1024,
				source: "fallback",
			});

			await expect(getTranscription("/mock/audio.wav")).rejects.toThrow("Not enough memory");
			expect(mockDispatch).toHaveBeenCalledWith("stt", { type: "LOAD_FAIL_BUDGET" });
		});

		it("releases STT after transcription when releaseSTTAfterUse is true", async () => {
			await initSTT();
			expect(getSTTStatus()).toBe("ready");

			mockGetDeviceTierStrategy.mockReturnValue({ releaseSTTAfterUse: true });

			const text = await getTranscription("/mock/audio.wav");
			expect(text).toBe("hello world");

			// STT should be released to reclaim memory on low-memory tiers
			expect(getSTTStatus()).toBe("released");
			expect(mockDispatch).toHaveBeenCalledWith("stt", { type: "MEMORY_PRESSURE" });
			expect(mockDispatch).toHaveBeenCalledWith("stt", { type: "RELEASE_COMPLETE" });
		});

		it("keeps STT loaded after transcription when releaseSTTAfterUse is false", async () => {
			await initSTT();
			expect(getSTTStatus()).toBe("ready");

			mockGetDeviceTierStrategy.mockReturnValue({ releaseSTTAfterUse: false });

			const text = await getTranscription("/mock/audio.wav");
			expect(text).toBe("hello world");

			// STT should remain ready on higher-memory tiers
			expect(getSTTStatus()).toBe("ready");
			expect(mockDispatch).not.toHaveBeenCalledWith("stt", { type: "MEMORY_PRESSURE" });
			expect(mockDispatch).not.toHaveBeenCalledWith("stt", { type: "RELEASE_COMPLETE" });
		});
	});

	describe("releaseSTT", () => {
		it("sets status to released", async () => {
			await initSTT();
			await releaseSTT();
			expect(getSTTStatus()).toBe("released");
			expect(isAvailable()).toBe(false);
		});
	});
});
