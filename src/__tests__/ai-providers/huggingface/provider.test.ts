// ─── Mock definitions (must precede all imports) ────────────────────────────

const mockInitLlama = jest.fn();
const mockReleaseAllLlama = jest.fn();
const mockCompletion = jest.fn();
const mockStopCompletion = jest.fn();
const mockInitMultimodal = jest.fn();
const mockGetMultimodalSupport = jest.fn();
const mockReleaseMultimodal = jest.fn();
const mockClearCache = jest.fn();
const mockToggleNativeLog = jest.fn();
const mockAddNativeLogListener = jest.fn();

jest.mock("llama.rn", () => ({
	initLlama: (...args: unknown[]) => mockInitLlama(...args),
	releaseAllLlama: (...args: unknown[]) => mockReleaseAllLlama(...args),
	toggleNativeLog: (...args: unknown[]) => mockToggleNativeLog(...args),
	addNativeLogListener: (...args: unknown[]) => mockAddNativeLogListener(...args),
}));

const mockFileDelete = jest.fn();
let mockFileExistsValue = true;
let mockFileSizeValue = 2 * 1024 * 1024 * 1024; // 2 GB

jest.mock("expo-file-system", () => ({
	Directory: jest.fn().mockImplementation(() => ({
		uri: "file:///mock/documents",
	})),
	Paths: { document: "file:///mock/documents" },
	File: jest.fn().mockImplementation(() => ({
		get exists() {
			return mockFileExistsValue;
		},
		get size() {
			return mockFileSizeValue;
		},
		delete: (...args: unknown[]) => mockFileDelete(...args),
	})),
}));

jest.mock("expo-device", () => ({
	totalMemory: 8 * 1024 * 1024 * 1024, // 8 GB
}));

const mockCheckBudget = jest.fn();
const mockGetDeviceMemoryTier = jest.fn();
const mockGetDeviceTierStrategy = jest.fn();

jest.mock("../../../memory/budget", () => ({
	checkBudget: (...args: unknown[]) => mockCheckBudget(...args),
	getDeviceMemoryTier: (...args: unknown[]) => mockGetDeviceMemoryTier(...args),
	getDeviceTierStrategy: (...args: unknown[]) => mockGetDeviceTierStrategy(...args),
}));

jest.mock("../../../utils/bytes", () => ({
	bytesToGB: jest.fn((bytes: number) => bytes / (1024 * 1024 * 1024)),
}));

jest.mock("../../../actions/secure-credentials", () => ({
	deleteProviderCredentials: jest.fn().mockResolvedValue(undefined),
}));

const mockDispatch = jest.fn();
const mockSubscribe = jest.fn();
const mockGetCapabilityStatus = jest.fn();
const mockResetState = jest.fn();

jest.mock("../../../memory/state", () => ({
	dispatch: (...args: unknown[]) => mockDispatch(...args),
	subscribe: (...args: unknown[]) => mockSubscribe(...args),
	getCapabilityStatus: (...args: unknown[]) => mockGetCapabilityStatus(...args),
	resetState: (...args: unknown[]) => mockResetState(...args),
}));

const mockSetReleaseMultimodalFn = jest.fn();
const mockStartMemoryPressureMonitor = jest.fn();

jest.mock("../../../utils/memory-pressure", () => ({
	setReleaseMultimodalFn: (...args: unknown[]) => mockSetReleaseMultimodalFn(...args),
	startMemoryPressureMonitor: (...args: unknown[]) => mockStartMemoryPressureMonitor(...args),
}));

const mockInitSTT = jest.fn();

jest.mock("../../../stt", () => ({
	initSTT: (...args: unknown[]) => mockInitSTT(...args),
}));

const mockGetAvailableMemory = jest.fn();

jest.mock("../../../utils/native-memory", () => ({
	getAvailableMemory: (...args: unknown[]) => mockGetAvailableMemory(...args),
}));

const mockStartDownload = jest.fn();
const mockPauseDownload = jest.fn();
const mockResumeDownload = jest.fn();

jest.mock("../../../ai-providers/huggingface/download", () => ({
	startDownload: (...args: unknown[]) => mockStartDownload(...args),
	pauseDownload: (...args: unknown[]) => mockPauseDownload(...args),
	resumeDownload: (...args: unknown[]) => mockResumeDownload(...args),
}));

const mockSearchModels = jest.fn();

jest.mock("../../../ai-providers/huggingface/api", () => ({
	searchModels: (...args: unknown[]) => mockSearchModels(...args),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import { createHuggingFaceProvider, loadVisionOnDemand } from "@/src/ai-providers/huggingface/provider";
import type { AIProvider } from "@/src/ai-providers/types";

// ─── Mock Store ──────────────────────────────────────────────────────────────

function createMockStore() {
	const data: Record<string, Record<string, Record<string, unknown>>> = {
		aiProviders: {},
		hfModels: {},
	};

	return {
		getCell: jest.fn(
			(table: string, row: string, cell: string) =>
				data[table]?.[row]?.[cell],
		),
		setCell: jest.fn(
			(table: string, row: string, cell: string, value: unknown) => {
				if (!data[table]) data[table] = {};
				if (!data[table][row]) data[table][row] = {};
				data[table][row][cell] = value;
			},
		),
		getRow: jest.fn(
			(table: string, row: string) => data[table]?.[row],
		),
		getRowIds: jest.fn((table: string) =>
			Object.keys(data[table] || {}),
		),
		delRow: jest.fn((table: string, row: string) => {
			if (data[table]) {
				delete data[table][row];
			}
		}),
		setRow: jest.fn(
			(table: string, row: string, rowData: Record<string, unknown>) => {
				if (!data[table]) data[table] = {};
				data[table][row] = rowData;
			},
		),
		_data: data,
	};
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seedStoreWithDownloadedModel(store: ReturnType<typeof createMockStore>) {
	store._data.aiProviders.huggingface = {
		id: "huggingface",
		status: "needs_setup",
		error: "",
		selectedModelId: "test-org__test-model__model-Q4_K_M.gguf",
		modelCard: "",
		modelCardId: "",
		configVersion: "",
		downloadedAt: "",
		filename: "hf-test-model-Q4_K_M.gguf",
		progressSizeGB: 0,
		totalSizeGB: 0,
		downloadError: "",
		resumableState: "",
		isPaused: false,
		fileRemoved: false,
		mmprojFilename: "",
	};
	store._data.hfModels["test-org__test-model__model-Q4_K_M.gguf"] = {
		id: "test-org__test-model__model-Q4_K_M.gguf",
		repoId: "test-org/test-model-GGUF",
		filename: "model-Q4_K_M.gguf",
		displayName: "Test Model Q4_K_M",
		fileSizeBytes: 2 * 1024 * 1024 * 1024,
		localFilename: "hf-test-model-Q4_K_M.gguf",
		downloadUrl: "https://huggingface.co/test-org/test-model-GGUF/resolve/main/model-Q4_K_M.gguf",
		sha256: "abc123",
		downloadedAt: "2025-06-15T12:00:00.000Z",
	};
}

function createMockLlamaContext() {
	return {
		completion: mockCompletion,
		stopCompletion: mockStopCompletion,
		initMultimodal: mockInitMultimodal,
		getMultimodalSupport: mockGetMultimodalSupport,
		releaseMultimodal: mockReleaseMultimodal,
		clearCache: mockClearCache,
		model: {},
	};
}

function createHybridMockLlamaContext() {
	return {
		completion: mockCompletion,
		stopCompletion: mockStopCompletion,
		initMultimodal: mockInitMultimodal,
		getMultimodalSupport: mockGetMultimodalSupport,
		releaseMultimodal: mockReleaseMultimodal,
		clearCache: mockClearCache,
		model: { is_hybrid: true },
	};
}

function seedStoreWithVisionModel(store: ReturnType<typeof createMockStore>) {
	store._data.aiProviders.huggingface = {
		id: "huggingface",
		status: "needs_setup",
		error: "",
		selectedModelId: "test-org__vision-model__model-Q4_K_M.gguf",
		modelCard: "",
		modelCardId: "",
		configVersion: "",
		downloadedAt: "",
		filename: "hf-vision-model-Q4_K_M.gguf",
		progressSizeGB: 0,
		totalSizeGB: 0,
		downloadError: "",
		resumableState: "",
		isPaused: false,
		fileRemoved: false,
		mmprojFilename: "",
	};
	store._data.hfModels["test-org__vision-model__model-Q4_K_M.gguf"] = {
		id: "test-org__vision-model__model-Q4_K_M.gguf",
		repoId: "test-org/vision-model-GGUF",
		filename: "model-Q4_K_M.gguf",
		displayName: "Vision Model Q4_K_M",
		fileSizeBytes: 2 * 1024 * 1024 * 1024,
		localFilename: "hf-vision-model-Q4_K_M.gguf",
		downloadUrl: "https://huggingface.co/test-org/vision-model-GGUF/resolve/main/model-Q4_K_M.gguf",
		sha256: "def456",
		downloadedAt: "2025-06-15T12:00:00.000Z",
		pipelineTag: "image-text-to-text",
		mmprojFilename: "mmproj-f16.gguf",
		mmprojDownloadUrl: "https://huggingface.co/test-org/vision-model-GGUF/resolve/main/mmproj-f16.gguf",
		mmprojSizeBytes: 850000000,
		mmprojLocalFilename: "hf-test-org-vision-model-GGUF-mmproj-f16.gguf",
		mmprojDownloadedAt: "2025-06-15T12:05:00.000Z",
	};
}

function setupDefaultMocks() {
	mockReleaseAllLlama.mockResolvedValue(undefined);
	mockToggleNativeLog.mockResolvedValue(undefined);
	mockAddNativeLogListener.mockReturnValue(undefined);
	mockGetAvailableMemory.mockResolvedValue({
		bytes: 4 * 1024 * 1024 * 1024,
		source: "native",
	});
	mockCheckBudget.mockResolvedValue({
		canLoad: true,
		availableBytes: 6 * 1024 * 1024 * 1024,
		estimatedModelBytes: 2 * 1024 * 1024 * 1024,
		source: "native",
	});
	mockGetDeviceMemoryTier.mockReturnValue("full");
	mockGetDeviceTierStrategy.mockReturnValue({
		maxChatModelGB: 4.0,
		preWarmVision: true,
		preWarmSTT: true,
		allowOnDemandVision: true,
		allowOnDemandSTT: true,
		releaseSTTAfterUse: false,
	});
	mockGetCapabilityStatus.mockReturnValue("unloaded");
	mockSubscribe.mockReturnValue(jest.fn()); // returns unsubscribe fn
	mockResetState.mockReturnValue(undefined);
	mockDispatch.mockReturnValue("loading");
	mockInitSTT.mockResolvedValue(undefined);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("HuggingFace provider", () => {
	let store: ReturnType<typeof createMockStore>;
	let provider: AIProvider & { deleteModel: (modelId: string) => Promise<void> };

	beforeEach(async () => {
		jest.clearAllMocks();
		mockFileExistsValue = true;
		mockFileSizeValue = 2 * 1024 * 1024 * 1024;
		setupDefaultMocks();

		store = createMockStore();
		provider = createHuggingFaceProvider(store as never) as AIProvider & {
			deleteModel: (modelId: string) => Promise<void>;
		};

		// Ensure module-scoped llamaContext is reset between tests
		await provider.teardown();
		jest.clearAllMocks();
		setupDefaultMocks();
	});

	// ── Identity ──────────────────────────────────────────────────────────

	describe("identity", () => {
		it("has correct id and name", () => {
			expect(provider.id).toBe("huggingface");
			expect(provider.name).toBe("Hugging Face");
		});

		it("is a local provider with download capability", () => {
			expect(provider.type).toBe("local");
			expect(provider.capabilities.download).toBe(true);
			expect(provider.capabilities.oauth).toBe(false);
			expect(provider.capabilities.userApiKey).toBe(false);
		});
	});

	// ── enable / disable ──────────────────────────────────────────────────

	describe("enable", () => {
		it("creates aiProviders row with needs_setup status", () => {
			provider.enable();

			expect(store.setRow).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				expect.objectContaining({
					id: "huggingface",
					status: "needs_setup",
				}),
			);
		});
	});

	describe("disable", () => {
		it("releases llama context, deletes model files, and removes provider row", async () => {
			seedStoreWithDownloadedModel(store);

			await provider.disable();

			expect(mockReleaseAllLlama).toHaveBeenCalled();
			expect(mockFileDelete).toHaveBeenCalled();
			expect(store.delRow).toHaveBeenCalledWith("hfModels", "test-org__test-model__model-Q4_K_M.gguf");
			expect(store.delRow).toHaveBeenCalledWith("aiProviders", "huggingface");
		});

		it("calls resetState and setReleaseMultimodalFn(null)", async () => {
			seedStoreWithDownloadedModel(store);

			await provider.disable();

			expect(mockResetState).toHaveBeenCalled();
			expect(mockSetReleaseMultimodalFn).toHaveBeenCalledWith(null);
		});
	});

	// ── setup ─────────────────────────────────────────────────────────────

	describe("setup", () => {
		it("sets status to needs_setup when no model selected", async () => {
			store._data.aiProviders.huggingface = {
				id: "huggingface",
				status: "needs_setup",
				selectedModelId: "",
			};

			await provider.setup();

			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"needs_setup",
			);
			expect(mockInitLlama).not.toHaveBeenCalled();
		});

		it("sets status to needs_setup when model not downloaded", async () => {
			store._data.aiProviders.huggingface = {
				id: "huggingface",
				status: "needs_setup",
				selectedModelId: "some-model",
			};
			store._data.hfModels["some-model"] = {
				id: "some-model",
				downloadedAt: "", // not downloaded
				localFilename: "model.gguf",
			};

			await provider.setup();

			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"needs_setup",
			);
			expect(mockInitLlama).not.toHaveBeenCalled();
		});

		it("sets fileRemoved and needs_setup when GGUF file is missing", async () => {
			mockFileExistsValue = false;
			seedStoreWithDownloadedModel(store);

			await provider.setup();

			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"fileRemoved",
				true,
			);
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"needs_setup",
			);
			expect(mockInitLlama).not.toHaveBeenCalled();
		});

		it("detects truncated file and sets fileRemoved", async () => {
			// File size is much smaller than expected (truncated download)
			mockFileSizeValue = 500 * 1024 * 1024; // 500 MB actual
			seedStoreWithDownloadedModel(store);
			// Expected size is 2 GB (from seedStoreWithDownloadedModel)

			await provider.setup();

			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"fileRemoved",
				true,
			);
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"needs_setup",
			);
			expect(mockInitLlama).not.toHaveBeenCalled();
		});

		it("calls initLlama with correct params on successful setup", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			expect(mockInitLlama).toHaveBeenCalledWith(
				expect.objectContaining({
					model: expect.stringContaining("hf-test-model-Q4_K_M.gguf"),
					n_ctx: 2048,
					cache_type_k: "f16",
					cache_type_v: "f16",
				}),
			);

			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"ready",
			);
		});

		it("sets error status when budget check fails", async () => {
			seedStoreWithDownloadedModel(store);
			mockCheckBudget.mockResolvedValue({
				canLoad: false,
				availableBytes: 1 * 1024 * 1024 * 1024,
				estimatedModelBytes: 2 * 1024 * 1024 * 1024,
				source: "native",
			});

			await expect(provider.setup()).rejects.toThrow("Not enough memory");

			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"error",
			);
			expect(mockInitLlama).not.toHaveBeenCalled();
		});

		it("retries CPU-only when GPU load fails", async () => {
			seedStoreWithDownloadedModel(store);
			mockGetDeviceMemoryTier.mockReturnValue("balanced"); // gpuLayers = 32

			// First call fails, second succeeds
			mockInitLlama
				.mockRejectedValueOnce(new Error("GPU OOM"))
				.mockResolvedValueOnce(createMockLlamaContext());

			await provider.setup();

			expect(mockInitLlama).toHaveBeenCalledTimes(2);
			// Second call should have n_gpu_layers: 0
			expect(mockInitLlama.mock.calls[1][0]).toMatchObject({
				n_gpu_layers: 0,
				use_mlock: false,
			});
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"ready",
			);
		});

		it("throws when CPU-only load also fails", async () => {
			seedStoreWithDownloadedModel(store);
			mockGetDeviceMemoryTier.mockReturnValue("minimal"); // gpuLayers = 0

			mockInitLlama.mockRejectedValue(new Error("Model corrupt"));

			await expect(provider.setup()).rejects.toThrow("Model corrupt");

			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"error",
			);
		});

		it("returns immediately if context already loaded", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			// First setup loads the context
			await provider.setup();
			jest.clearAllMocks();
			setupDefaultMocks();

			// Second setup should return immediately
			await provider.setup();

			expect(mockInitLlama).not.toHaveBeenCalled();
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"ready",
			);
		});

		it("prevents concurrent setup calls", async () => {
			seedStoreWithDownloadedModel(store);

			let resolveInit!: (ctx: unknown) => void;
			mockInitLlama.mockReturnValue(
				new Promise((resolve) => {
					resolveInit = resolve;
				}),
			);

			const setup1 = provider.setup();
			const setup2 = provider.setup();

			resolveInit(createMockLlamaContext());

			await Promise.all([setup1, setup2]);

			// initLlama should only be called once
			expect(mockInitLlama).toHaveBeenCalledTimes(1);
		});

		it("uses 0 GPU layers for minimal/conservative tiers", async () => {
			seedStoreWithDownloadedModel(store);
			mockGetDeviceMemoryTier.mockReturnValue("minimal");
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			expect(mockInitLlama.mock.calls[0][0].n_gpu_layers).toBe(0);
		});

		it("calls toggleNativeLog(true) during setup", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			expect(mockToggleNativeLog).toHaveBeenCalledWith(true);
		});

		it("calls startMemoryPressureMonitor() during setup", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			expect(mockStartMemoryPressureMonitor).toHaveBeenCalled();
		});

		it("uses RAM-linear context scaling capped by model context length", async () => {
			seedStoreWithDownloadedModel(store);
			// Add contextLength to hfModels row
			store._data.hfModels["test-org__test-model__model-Q4_K_M.gguf"].contextLength = 32768;
			mockGetDeviceMemoryTier.mockReturnValue("conservative");
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			// 8 GB RAM, ~2 GB model file → ramScaledCtx = max(512, round(8 * 1024 / ~2.0)) ≈ 4096
			// nCtx = min(32768, 4096) = 4096
			const nCtx = mockInitLlama.mock.calls[0][0].n_ctx;
			expect(nCtx).toBeGreaterThanOrEqual(512);
			expect(nCtx).toBeLessThanOrEqual(32768);
			expect(provider.getContextSize()).toBe(nCtx);
		});

		it("logs available memory after releaseAllLlama", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			expect(mockGetAvailableMemory).toHaveBeenCalled();
		});

		it("calls resetState() during setup", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			expect(mockResetState).toHaveBeenCalled();
		});

		it("subscribes to state machine changes during setup", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			expect(mockSubscribe).toHaveBeenCalledWith(expect.any(Function));
		});

		it("sets up memory pressure release function during setup", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			expect(mockSetReleaseMultimodalFn).toHaveBeenCalledWith(expect.any(Function));
		});
	});

	// ── completion ────────────────────────────────────────────────────────

	describe("completion", () => {
		beforeEach(async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			await provider.setup();
		});

		it("streams tokens via onToken callback", async () => {
			const tokens: string[] = [];
			mockCompletion.mockImplementation(
				(params: unknown, callback: (data: { token: string }) => void) => {
					callback({ token: "Hello" });
					callback({ token: " world" });
					return Promise.resolve({
						content: "Hello world",
						stopped_eos: true,
						tokens_evaluated: 5,
						tokens_predicted: 2,
					});
				},
			);

			const result = await provider.completion(
				[{ role: "user", content: "Hi" }],
				(token) => tokens.push(token),
			);

			expect(tokens).toEqual(["Hello", " world"]);
			expect(result.content).toBe("Hello world");
			expect(result.finishReason).toBe("stop");
			expect(result.usage?.promptTokens).toBe(5);
			expect(result.usage?.completionTokens).toBe(2);
		});

		it("passes stop: [] explicitly in completion params", async () => {
			mockCompletion.mockResolvedValue({
				content: "test",
				stopped_eos: true,
				tokens_evaluated: 1,
				tokens_predicted: 1,
			});

			await provider.completion(
				[{ role: "user", content: "Hi" }],
				() => {},
			);

			expect(mockCompletion.mock.calls[0][0]).toMatchObject({
				stop: [],
			});
		});

		it("returns length finish reason when context is full", async () => {
			mockCompletion.mockResolvedValue({
				content: "partial",
				stopped_eos: false,
				context_full: true,
				tokens_evaluated: 10,
				tokens_predicted: 50,
			});

			const result = await provider.completion(
				[{ role: "user", content: "Tell me a story" }],
				() => {},
			);

			expect(result.finishReason).toBe("length");
		});

		it("returns error result when no context loaded", async () => {
			// Teardown the context loaded by this describe's beforeEach
			await provider.teardown();

			const result = await provider.completion(
				[{ role: "user", content: "Hi" }],
				() => {},
			);

			expect(result.content).toBe("");
			expect(result.finishReason).toBe("error");
		});

		it("converts multimodal parts to llama.rn format", async () => {
			mockCompletion.mockResolvedValue({
				content: "I see an image",
				stopped_eos: true,
				tokens_evaluated: 10,
				tokens_predicted: 4,
			});

			await provider.completion(
				[
					{
						role: "user",
						content: [
							{ type: "text", text: "What is this?" },
							{ type: "image", uri: "file:///img.jpg", mimeType: "image/jpeg", alt: "a photo" },
						],
					},
				],
				() => {},
			);

			// Provider should call llamaContext.completion with converted messages
			const calledMessages = mockCompletion.mock.calls[0][0].messages;
			expect(calledMessages[0].content).toEqual([
				{ type: "text", text: "What is this?" },
				{ type: "text", text: "[a photo]" }, // image falls back to alt text (no vision)
			]);
		});
	});

	// ── stopCompletion ────────────────────────────────────────────────────

	describe("stopCompletion", () => {
		it("calls stopCompletion on the llama context", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			await provider.setup();

			provider.stopCompletion();

			expect(mockStopCompletion).toHaveBeenCalledTimes(1);
		});

		it("does nothing when no context loaded", () => {
			// Fresh provider
			provider.stopCompletion();
			expect(mockStopCompletion).not.toHaveBeenCalled();
		});
	});

	// ── teardown ──────────────────────────────────────────────────────────

	describe("teardown", () => {
		it("releases llama context and resets state", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			await provider.setup();

			expect(provider.isConfigured()).toBe(true);

			await provider.teardown();

			expect(mockReleaseAllLlama).toHaveBeenCalled();
			expect(provider.isConfigured()).toBe(false);
			expect(provider.getContextSize()).toBe(2048); // reset to default
		});

		it("preserves provider store status after teardown", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			await provider.setup();

			// Clear mocks so we can check teardown doesn't set status
			store.setCell.mockClear();

			await provider.teardown();

			// teardown should NOT change status — it only releases runtime state
			const statusCalls = store.setCell.mock.calls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "huggingface" &&
					call[2] === "status",
			);
			expect(statusCalls.length).toBe(0);
		});

		it("calls resetState() and setReleaseMultimodalFn(null)", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			await provider.setup();
			jest.clearAllMocks();
			setupDefaultMocks();

			await provider.teardown();

			expect(mockResetState).toHaveBeenCalled();
			expect(mockSetReleaseMultimodalFn).toHaveBeenCalledWith(null);
		});

		it("dispatches TEARDOWN events for ready capabilities", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			await provider.setup();
			jest.clearAllMocks();
			setupDefaultMocks();

			// Simulate vision being ready
			mockGetCapabilityStatus.mockImplementation((cap: string) =>
				cap === "vision" ? "ready" : "unloaded",
			);

			await provider.teardown();

			expect(mockDispatch).toHaveBeenCalledWith("vision", { type: "TEARDOWN" });
		});
	});

	// ── clearCache ────────────────────────────────────────────────────────

	describe("clearCache", () => {
		it("calls llamaContext.clearCache(false) for hybrid models", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createHybridMockLlamaContext());
			await provider.setup();

			await provider.clearCache!();

			expect(mockClearCache).toHaveBeenCalledWith(false);
		});

		it("does nothing for non-hybrid models", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			await provider.setup();

			await provider.clearCache!();

			expect(mockClearCache).not.toHaveBeenCalled();
		});

		it("does nothing when no context loaded", async () => {
			await provider.clearCache!();

			expect(mockClearCache).not.toHaveBeenCalled();
		});
	});

	// ── setModel ──────────────────────────────────────────────────────────

	describe("setModel", () => {
		it("updates selectedModelId and filename in store", () => {
			store._data.hfModels["new-model"] = {
				id: "new-model",
				localFilename: "hf-new-model.gguf",
			};

			provider.setModel("new-model");

			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"selectedModelId",
				"new-model",
			);
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"filename",
				"hf-new-model.gguf",
			);
		});
	});

	// ── model switching ───────────────────────────────────────────────────

	describe("model switching", () => {
		it("loading a new model after teardown works correctly", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			// Load first model
			await provider.setup();
			expect(provider.isConfigured()).toBe(true);

			// Teardown
			await provider.teardown();
			expect(provider.isConfigured()).toBe(false);

			// Set up a different model
			store._data.hfModels["model-b"] = {
				id: "model-b",
				downloadedAt: "2025-06-15T12:00:00.000Z",
				localFilename: "hf-model-b.gguf",
			};
			store._data.aiProviders.huggingface.selectedModelId = "model-b";
			store._data.aiProviders.huggingface.filename = "hf-model-b.gguf";

			jest.clearAllMocks();
			setupDefaultMocks();
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			// Load second model
			await provider.setup();

			expect(mockInitLlama).toHaveBeenCalledWith(
				expect.objectContaining({
					model: expect.stringContaining("hf-model-b.gguf"),
				}),
			);
			expect(provider.isConfigured()).toBe(true);
		});
	});

	// ── isConfigured ──────────────────────────────────────────────────────

	describe("isConfigured", () => {
		it("returns false when no context loaded", () => {
			expect(provider.isConfigured()).toBe(false);
		});

		it("returns true after setup", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			await provider.setup();

			expect(provider.isConfigured()).toBe(true);
		});
	});

	// ── getSystemMessage ──────────────────────────────────────────────────

	describe("getSystemMessage", () => {
		it("returns system message mentioning on-device and privacy", () => {
			const msg = provider.getSystemMessage([]);
			expect(msg).toContain("Hugging Face");
			expect(msg).toContain("on-device");
			expect(msg).toContain("device");
		});
	});

	// ── getContextSize ────────────────────────────────────────────────────

	describe("getContextSize", () => {
		it("returns default 2048 before setup", () => {
			expect(provider.getContextSize()).toBe(2048);
		});

		it("returns context size used during setup", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			await provider.setup();

			expect(provider.getContextSize()).toBe(2048);
		});
	});

	// ── getMultimodalCapabilities ─────────────────────────────────────────

	describe("getMultimodalCapabilities", () => {
		it("returns vision: false, audio: true, files: false after setup", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			await provider.setup();

			const caps = provider.getMultimodalCapabilities();
			expect(caps.vision).toBe(false);
			expect(caps.audio).toBe(true);
			expect(caps.files).toBe(false);
		});

		it("resets to NO_MULTIMODAL on teardown", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			await provider.setup();

			await provider.teardown();

			const caps = provider.getMultimodalCapabilities();
			expect(caps.vision).toBe(false);
			expect(caps.audio).toBe(false);
			expect(caps.files).toBe(false);
		});
	});

	// ── models ────────────────────────────────────────────────────────────

	describe("models", () => {
		it("returns downloaded models when no search query", async () => {
			seedStoreWithDownloadedModel(store);

			const models = await provider.models();

			expect(models.length).toBe(1);
			expect(models[0].id).toBe("test-org__test-model__model-Q4_K_M.gguf");
			expect(models[0].name).toBe("Test Model Q4_K_M");
		});

		it("searches HF Hub API when search query provided", async () => {
			mockSearchModels.mockResolvedValue([
				{
					repoId: "org/model-GGUF",
					author: "org",
					pipelineTag: "text-generation",
					downloads: 5000,
					likes: 100,
					tags: ["gguf"],
					lastModified: "2025-01-01",
				},
			]);

			const models = await provider.models("test query");

			expect(mockSearchModels).toHaveBeenCalledWith("test query");
			expect(models.length).toBe(1);
			expect(models[0].id).toBe("org/model-GGUF");
		});
	});

	// ── deleteModel ───────────────────────────────────────────────────────

	describe("deleteModel", () => {
		it("deletes file and removes hfModels row", async () => {
			seedStoreWithDownloadedModel(store);
			const modelId = "test-org__test-model__model-Q4_K_M.gguf";

			await provider.deleteModel(modelId);

			expect(mockFileDelete).toHaveBeenCalled();
			expect(store.delRow).toHaveBeenCalledWith("hfModels", modelId);
		});

		it("releases context and sets needs_setup when deleting active model", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			await provider.setup();

			jest.clearAllMocks();
			setupDefaultMocks();

			const modelId = "test-org__test-model__model-Q4_K_M.gguf";
			// Ensure selectedModelId matches
			store._data.aiProviders.huggingface.selectedModelId = modelId;

			await provider.deleteModel(modelId);

			expect(mockReleaseAllLlama).toHaveBeenCalled();
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"selectedModelId",
				"",
			);
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"needs_setup",
			);
		});

		it("does nothing when model not found", async () => {
			await provider.deleteModel("nonexistent-model");

			expect(mockFileDelete).not.toHaveBeenCalled();
			expect(store.delRow).not.toHaveBeenCalled();
		});
	});

	// ── download delegation ───────────────────────────────────────────────

	describe("download delegation", () => {
		it("delegates startDownload to download module", async () => {
			mockStartDownload.mockResolvedValue(undefined);
			await provider.startDownload!();
			expect(mockStartDownload).toHaveBeenCalledWith(store, undefined);
		});

		it("delegates pauseDownload to download module", () => {
			provider.pauseDownload!();
			expect(mockPauseDownload).toHaveBeenCalledWith(store);
		});

		it("delegates resumeDownload to download module", async () => {
			mockResumeDownload.mockResolvedValue(undefined);
			await provider.resumeDownload!();
			expect(mockResumeDownload).toHaveBeenCalledWith(store);
		});
	});

	// ── vision / multimodal ──────────────────────────────────────────────

	describe("vision / multimodal", () => {
		it("passes ctx_shift: false for vision models", async () => {
			seedStoreWithVisionModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			mockInitMultimodal.mockResolvedValue(undefined);
			mockGetMultimodalSupport.mockResolvedValue({ vision: true });

			await provider.setup();

			expect(mockInitLlama).toHaveBeenCalledWith(
				expect.objectContaining({
					ctx_shift: false,
				}),
			);
		});

		it("does not pass ctx_shift for text-only models", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			const initArgs = mockInitLlama.mock.calls[0][0];
			expect(initArgs.ctx_shift).toBeUndefined();
		});

		it("loads vision via pre-warm when tier allows", async () => {
			seedStoreWithVisionModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			mockInitMultimodal.mockResolvedValue(undefined);
			mockGetMultimodalSupport.mockResolvedValue({ vision: true });
			// getCapabilityStatus returns "unloaded" initially, then update on dispatch
			mockGetCapabilityStatus.mockReturnValue("unloaded");
			mockDispatch.mockReturnValue("loading");

			await provider.setup();

			// Wait for pre-warm IIFE to complete
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(mockInitMultimodal).toHaveBeenCalledWith(
				expect.objectContaining({
					path: expect.stringContaining("hf-test-org-vision-model-GGUF-mmproj-f16.gguf"),
					use_gpu: false,
				}),
			);
		});

		it("does not pre-warm vision when tier disallows", async () => {
			seedStoreWithVisionModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			mockGetDeviceTierStrategy.mockReturnValue({
				maxChatModelGB: 1.5,
				preWarmVision: false,
				preWarmSTT: false,
				allowOnDemandVision: false,
				allowOnDemandSTT: true,
				releaseSTTAfterUse: true,
			});

			await provider.setup();

			// Wait for pre-warm IIFE to complete (it should be a no-op)
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(mockInitMultimodal).not.toHaveBeenCalled();
		});

		it("returns vision: false when mmproj is not downloaded", async () => {
			seedStoreWithVisionModel(store);
			// Remove mmproj downloaded state
			store._data.hfModels["test-org__vision-model__model-Q4_K_M.gguf"].mmprojDownloadedAt = "";

			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			// Wait for pre-warm IIFE
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(mockInitMultimodal).not.toHaveBeenCalled();
			const caps = provider.getMultimodalCapabilities();
			expect(caps.vision).toBe(false);
		});

		it("handles vision pre-warm failure gracefully (non-fatal)", async () => {
			seedStoreWithVisionModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			mockInitMultimodal.mockRejectedValue(new Error("GPU OOM"));
			mockGetCapabilityStatus.mockReturnValue("unloaded");
			mockDispatch.mockReturnValue("loading");

			await provider.setup();

			// Wait for pre-warm IIFE
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Model should still be ready, just without vision
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"ready",
			);
			const caps = provider.getMultimodalCapabilities();
			expect(caps.vision).toBe(false);
		});

		it("resets resolvedMultimodalCaps on teardown", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			// After setup, caps have audio: true
			expect(provider.getMultimodalCapabilities().audio).toBe(true);

			await provider.teardown();

			// After teardown, should reset to NO_MULTIMODAL
			expect(provider.getMultimodalCapabilities().vision).toBe(false);
			expect(provider.getMultimodalCapabilities().audio).toBe(false);
		});

		it("converts image parts to image_url when vision is loaded via pre-warm", async () => {
			seedStoreWithVisionModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			mockInitMultimodal.mockResolvedValue(undefined);
			mockGetMultimodalSupport.mockResolvedValue({ vision: true });
			mockGetCapabilityStatus.mockReturnValue("unloaded");

			// When dispatch is called with LOAD_SUCCESS, simulate state machine success
			mockDispatch.mockImplementation((cap: string, event: { type: string }) => {
				if (cap === "vision" && event.type === "LOAD_SUCCESS") {
					return "ready";
				}
				return "loading";
			});

			await provider.setup();

			// Wait for pre-warm IIFE to complete
			await new Promise((resolve) => setTimeout(resolve, 50));

			mockCompletion.mockResolvedValue({
				content: "I see a cat",
				stopped_eos: true,
				tokens_evaluated: 10,
				tokens_predicted: 4,
			});

			await provider.completion(
				[
					{
						role: "user",
						content: [
							{ type: "text", text: "What is this?" },
							{ type: "image", uri: "file:///img.jpg", mimeType: "image/jpeg", alt: "a photo" },
						],
					},
				],
				() => {},
			);

			const calledMessages = mockCompletion.mock.calls[0][0].messages;
			expect(calledMessages[0].content).toEqual([
				{ type: "text", text: "What is this?" },
				{ type: "image_url", image_url: { url: "file:///img.jpg" } },
			]);
		});

		it("falls back to alt text when vision is not loaded", async () => {
			seedStoreWithDownloadedModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());

			await provider.setup();

			mockCompletion.mockResolvedValue({
				content: "I see an image",
				stopped_eos: true,
				tokens_evaluated: 10,
				tokens_predicted: 4,
			});

			await provider.completion(
				[
					{
						role: "user",
						content: [
							{ type: "text", text: "What is this?" },
							{ type: "image", uri: "file:///img.jpg", mimeType: "image/jpeg", alt: "a photo" },
						],
					},
				],
				() => {},
			);

			const calledMessages = mockCompletion.mock.calls[0][0].messages;
			expect(calledMessages[0].content).toEqual([
				{ type: "text", text: "What is this?" },
				{ type: "text", text: "[a photo]" },
			]);
		});

		it("deletes mmproj file when deleting a vision model", async () => {
			seedStoreWithVisionModel(store);

			const modelId = "test-org__vision-model__model-Q4_K_M.gguf";
			await provider.deleteModel(modelId);

			// Should delete both model and mmproj files (2 File() instances, 2 delete() calls)
			expect(mockFileDelete).toHaveBeenCalledTimes(2);
			expect(store.delRow).toHaveBeenCalledWith("hfModels", modelId);
		});
	});

	// ── loadVisionOnDemand ────────────────────────────────────────────────

	describe("loadVisionOnDemand (exported)", () => {
		// loadVisionOnDemand is tested indirectly via the pre-warm path above.
		// These tests verify the on-demand path directly by importing the function.

		it("returns false when budget denied", async () => {
			seedStoreWithVisionModel(store);
			mockInitLlama.mockResolvedValue(createMockLlamaContext());
			// Disable pre-warm so we can test on-demand
			mockGetDeviceTierStrategy.mockReturnValue({
				maxChatModelGB: 1.5,
				preWarmVision: false,
				preWarmSTT: false,
				allowOnDemandVision: true,
				allowOnDemandSTT: true,
				releaseSTTAfterUse: true,
			});

			await provider.setup();
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Now test on-demand loading with budget denied
			mockCheckBudget.mockResolvedValue({
				canLoad: false,
				availableBytes: 0.5 * 1024 * 1024 * 1024,
				estimatedModelBytes: 0.67 * 1024 * 1024 * 1024,
				source: "native",
			});
			mockGetCapabilityStatus.mockReturnValue("unloaded");
			mockDispatch.mockReturnValue("loading");

			const result = await loadVisionOnDemand(() => {});

			expect(result).toBe(false);
			expect(mockDispatch).toHaveBeenCalledWith("vision", { type: "LOAD_FAIL_BUDGET" });
		});
	});
});
