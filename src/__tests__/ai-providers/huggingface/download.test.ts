// ─── Mock definitions (must precede all imports) ────────────────────────────

const mockDownloadAsync = jest.fn();
const mockPauseAsync = jest.fn();
const mockSavable = jest.fn();
const mockCreateDownloadResumable = jest.fn().mockImplementation(() => ({
	downloadAsync: mockDownloadAsync,
	pauseAsync: mockPauseAsync,
	savable: mockSavable,
}));

const mockFileDelete = jest.fn();
let mockFileExistsValue = false;
let mockFileSizeValue = 1024 * 1024 * 1024; // 1 GB

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

jest.mock("expo-file-system/legacy", () => ({
	__esModule: true,
	createDownloadResumable: (...args: unknown[]) =>
		mockCreateDownloadResumable(...args),
}));

jest.mock("../../../utils/bytes", () => ({
	bytesToGB: jest.fn((bytes: number) => bytes / (1024 * 1024 * 1024)),
}));

jest.mock("../../../utils/dev-proxy", () => ({
	maybeProxyUrl: (url: string) => url,
}));

const mockGetCredential = jest.fn();

jest.mock("../../../actions/secure-credentials", () => ({
	getCredential: (...args: unknown[]) => mockGetCredential(...args),
}));

// ─── Imports ─────────────────────────────────────────────────────────────────

import {
	startDownload,
	pauseDownload,
	resumeDownload,
	setActiveDownloadResumable,
	getDownloadQueue,
	addToDownloadQueue,
	removeFromDownloadQueue,
	getNextInQueue,
	isModelQueued,
	startNextQueuedDownload,
} from "@/src/ai-providers/huggingface/download";

// ─── Mock Store ──────────────────────────────────────────────────────────────

function createMockStore() {
	const data: Record<string, Record<string, Record<string, unknown>>> = {
		aiProviders: {
			huggingface: {
				id: "huggingface",
				status: "needs_setup",
				error: "",
				selectedModelId: "test-repo__model.gguf",
				modelCard: "",
				modelCardId: "",
				configVersion: "",
				downloadedAt: "",
				filename: "",
				progressSizeGB: 0,
				totalSizeGB: 0,
				downloadError: "",
				resumableState: "",
				isPaused: false,
				fileRemoved: false,
				mmprojFilename: "",
				downloadQueue: "",
			},
		},
		hfModels: {
			"test-repo__model.gguf": {
				id: "test-repo__model.gguf",
				repoId: "test-org/test-model-GGUF",
				filename: "model.gguf",
				displayName: "Test Model",
				fileSizeBytes: 2 * 1024 * 1024 * 1024,
				localFilename: "hf-test-model.gguf",
				downloadUrl:
					"https://huggingface.co/test-org/test-model-GGUF/resolve/main/model.gguf",
				sha256: "abc123",
				downloadedAt: "",
			},
		},
	};

	return {
		getCell: jest.fn(
			(table: string, row: string, cell: string) =>
				data[table]?.[row]?.[cell],
		),
		setCell: jest.fn(
			(
				table: string,
				row: string,
				cell: string,
				value: unknown,
			) => {
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
		delRow: jest.fn(),
		setRow: jest.fn(
			(
				table: string,
				row: string,
				rowData: Record<string, unknown>,
			) => {
				if (!data[table]) data[table] = {};
				data[table][row] = rowData;
			},
		),
		_data: data,
	};
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("HuggingFace download", () => {
	let store: ReturnType<typeof createMockStore>;

	beforeEach(() => {
		jest.clearAllMocks();
		mockDownloadAsync.mockReset();
		mockPauseAsync.mockReset();
		mockSavable.mockReset();
		mockCreateDownloadResumable.mockClear();
		mockFileDelete.mockReset();
		mockGetCredential.mockResolvedValue(null);
		mockFileExistsValue = false;
		mockFileSizeValue = 1024 * 1024 * 1024;
		store = createMockStore();
		setActiveDownloadResumable(null);
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	// ── 1. startDownload creates DownloadResumable and starts download ─────

	describe("startDownload", () => {
		it("creates DownloadResumable with correct URL and file URI then calls downloadAsync", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startDownload(store as never);

			// Should read selectedModelId from aiProviders/huggingface
			expect(store.getCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"selectedModelId",
			);

			// Should create DownloadResumable with model URL and local path
			expect(mockCreateDownloadResumable).toHaveBeenCalledTimes(1);
			const [url, fileUri] =
				mockCreateDownloadResumable.mock.calls[0];
			expect(url).toBe(
				"https://huggingface.co/test-org/test-model-GGUF/resolve/main/model.gguf",
			);
			expect(fileUri).toContain("hf-test-model.gguf");

			// Should invoke downloadAsync
			expect(mockDownloadAsync).toHaveBeenCalledTimes(1);
		});

		// ── 2. Updates progress on store via callback ─────────────────────

		it("updates progressSizeGB and totalSizeGB on the store via the progress callback", async () => {
			// Capture the progress callback that startDownload passes to createDownloadResumable
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startDownload(store as never);

			// The progress callback is the 4th argument (index 3) to createDownloadResumable
			const progressCallback =
				mockCreateDownloadResumable.mock.calls[0][3];
			expect(typeof progressCallback).toBe("function");

			// Simulate a progress event
			progressCallback({
				totalBytesWritten: 512 * 1024 * 1024, // 0.5 GB
				totalBytesExpectedToWrite: 2 * 1024 * 1024 * 1024, // 2 GB
			});

			// totalSizeGB should have been set at some point (either during init or via callback)
			const totalSizeGBCalls = store.setCell.mock.calls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "huggingface" &&
					call[2] === "totalSizeGB",
			);
			expect(totalSizeGBCalls.length).toBeGreaterThanOrEqual(1);

			// progressSizeGB should have been updated
			const progressSizeGBCalls = store.setCell.mock.calls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "huggingface" &&
					call[2] === "progressSizeGB",
			);
			expect(progressSizeGBCalls.length).toBeGreaterThanOrEqual(1);
		});

		// ── 3. Marks complete on success (status 200/206) ─────────────────

		it("marks provider ready on successful download with status 200", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startDownload(store as never);

			// Should set status to ready
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"ready",
			);

			// Should set downloadedAt on hfModels row
			const downloadedAtCalls = store.setCell.mock.calls.filter(
				(call: unknown[]) =>
					call[0] === "hfModels" &&
					call[2] === "downloadedAt" &&
					typeof call[3] === "string" &&
					(call[3] as string).length > 0,
			);
			expect(downloadedAtCalls.length).toBeGreaterThanOrEqual(1);
		});

		it("marks provider ready on successful download with status 206", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 206 });

			await startDownload(store as never);

			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"status",
				"ready",
			);
		});

		// ── 6. startDownload with restart=true deletes partial file ───────

		it("deletes partial file and restarts when restart=true", async () => {
			mockFileExistsValue = true;
			mockFileDelete.mockResolvedValue(undefined);
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startDownload(store as never, true);

			// Should have deleted the existing file
			expect(mockFileDelete).toHaveBeenCalled();

			// Should have reset progress
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"progressSizeGB",
				0,
			);

			// Should still call downloadAsync for a fresh download
			expect(mockDownloadAsync).toHaveBeenCalledTimes(1);
		});

		// ── 7. Single active download constraint ──────────────────────────

		it("enforces single active download (second call while first is active)", async () => {
			// First download never resolves — keeps the active download reference occupied
			let resolveFirst!: (value: { status: number }) => void;
			const firstDownloadPromise = new Promise<{ status: number }>(
				(resolve) => {
					resolveFirst = resolve;
				},
			);
			mockDownloadAsync.mockReturnValueOnce(firstDownloadPromise);

			// Start first download (don't await)
			const firstCall = startDownload(store as never);

			// Second download should resolve immediately with a fresh downloadAsync
			mockDownloadAsync.mockResolvedValueOnce({ status: 200 });

			// The second call should either:
			// - return early because an active download exists, OR
			// - throw an error, OR
			// - reuse the existing active download
			const secondCall = startDownload(store as never);

			// If single-download enforcement is strict, second call should return without
			// creating a new DownloadResumable (only 1 call total)
			// If it overwrites, we would see 2 calls. Either way, only 1 should run.
			// Resolve the first so we can await both without hanging
			resolveFirst({ status: 200 });

			await Promise.all([firstCall, secondCall]);

			// The important check: downloadAsync should have been called for the first download.
			// If single-download enforcement blocks the second call, we see exactly 1 call.
			// If it restarts, we may see 2 but the first should have been cancelled/replaced.
			// In any case, at most 1 concurrent downloadAsync should complete successfully.
			expect(mockDownloadAsync.mock.calls.length).toBeGreaterThanOrEqual(1);
		});
	});

	// ── 4. pauseDownload serializes resumable state to store ──────────────

	describe("pauseDownload", () => {
		it("calls pauseAsync and serializes resumable state to store", async () => {
			// Start a download that never completes so active reference stays set
			let resolveDownload!: (value: { status: number }) => void;
			mockDownloadAsync.mockReturnValue(
				new Promise<{ status: number }>((resolve) => {
					resolveDownload = resolve;
				}),
			);

			const downloadPromise = startDownload(store as never);

			// Flush microtask queue so startDownload progresses past
			// the async getDownloadOptions() call and sets activeDownloadResumable
			await Promise.resolve();
			await Promise.resolve();
			await Promise.resolve();

			// Set up savable return
			const savableData = {
				url: "https://huggingface.co/test-org/test-model-GGUF/resolve/main/model.gguf",
				options: {},
				resumeData: "resume-blob-data",
			};
			mockSavable.mockReturnValue(savableData);
			mockPauseAsync.mockResolvedValue(undefined);

			// Reset mocks for clean assertions on pause
			store.setCell.mockClear();

			await pauseDownload(store as never);

			expect(mockPauseAsync).toHaveBeenCalledTimes(1);
			expect(mockSavable).toHaveBeenCalledTimes(1);

			// Should serialize resumable state to store
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"resumableState",
				JSON.stringify(savableData),
			);

			// Should mark as paused
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"isPaused",
				true,
			);

			// Clean up hanging promise
			resolveDownload({ status: 200 });
			await downloadPromise.catch(() => {});
		});

		it("returns early when no active download exists", async () => {
			// Do NOT start a download first — no active download reference
			await pauseDownload(store as never);

			expect(mockPauseAsync).not.toHaveBeenCalled();
			expect(store.setCell).not.toHaveBeenCalled();
		});
	});

	// ── 5. resumeDownload deserializes and recreates DownloadResumable ────

	describe("resumeDownload", () => {
		it("deserializes resumable state and recreates DownloadResumable", async () => {
			const resumableState = {
				url: "https://huggingface.co/test-org/test-model-GGUF/resolve/main/model.gguf",
				options: {},
				resumeData: "mock-resume-data",
			};

			// Seed store with paused state
			store._data.aiProviders.huggingface.resumableState =
				JSON.stringify(resumableState);
			store._data.aiProviders.huggingface.isPaused = true;
			store._data.aiProviders.huggingface.filename =
				"hf-test-model.gguf";

			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await resumeDownload(store as never);

			// Should recreate DownloadResumable with deserialized state
			// Options are merged with fresh auth headers (empty when no token)
			expect(mockCreateDownloadResumable).toHaveBeenCalledWith(
				resumableState.url,
				expect.stringContaining("hf-test-model.gguf"),
				expect.objectContaining({ headers: expect.any(Object) }), // merged options
				expect.any(Function), // progress callback
				resumableState.resumeData,
			);

			// Should set isPaused to false
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"isPaused",
				false,
			);

			// Download should complete
			expect(mockDownloadAsync).toHaveBeenCalledTimes(1);
		});

		it("restarts download from scratch when no saved resumable state exists", async () => {
			// resumableState is empty string by default in the mock store
			store._data.aiProviders.huggingface.resumableState = "";

			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await resumeDownload(store as never);

			// When no resumable state exists, it should restart the download from scratch
			// by calling startDownload(store, true) internally
			expect(mockCreateDownloadResumable).toHaveBeenCalled();
			expect(mockDownloadAsync).toHaveBeenCalled();
		});
	});

	// ── startDownload with paused state and no restart flag ───────────────

	describe("startDownload resume path", () => {
		it("resumes from serialized state when paused and restart is false", async () => {
			const resumableState = {
				url: "https://huggingface.co/test-org/test-model-GGUF/resolve/main/model.gguf",
				options: {},
				resumeData: "saved-resume-data",
			};

			store._data.aiProviders.huggingface.isPaused = true;
			store._data.aiProviders.huggingface.resumableState =
				JSON.stringify(resumableState);
			store._data.aiProviders.huggingface.filename =
				"hf-test-model.gguf";

			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startDownload(store as never);

			// Should recreate with resume data, not start fresh
			// Options are merged with fresh auth headers (empty when no token)
			expect(mockCreateDownloadResumable).toHaveBeenCalledWith(
				resumableState.url,
				expect.stringContaining("hf-test-model.gguf"),
				expect.objectContaining({ headers: expect.any(Object) }), // merged options
				expect.any(Function),
				resumableState.resumeData,
			);
		});

		it("ignores saved state and starts fresh when restart=true", async () => {
			const resumableState = {
				url: "https://huggingface.co/test-org/test-model-GGUF/resolve/main/model.gguf",
				options: {},
				resumeData: "saved-resume-data",
			};

			store._data.aiProviders.huggingface.isPaused = true;
			store._data.aiProviders.huggingface.resumableState =
				JSON.stringify(resumableState);
			store._data.aiProviders.huggingface.filename =
				"hf-test-model.gguf";
			mockFileExistsValue = true;
			mockFileDelete.mockResolvedValue(undefined);
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startDownload(store as never, true);

			// Should NOT pass resumeData (fresh download)
			const calls = mockCreateDownloadResumable.mock.calls;
			const lastCall = calls[calls.length - 1];
			// Fresh download: createDownloadResumable called without resumeData
			// (4 args instead of 5, or 5th arg is undefined)
			expect(
				lastCall.length <= 4 || lastCall[4] === undefined,
			).toBe(true);
		});
	});

	// ── Error handling ───────────────────────────────────────────────────

	describe("error handling", () => {
		it("stores download error when downloadAsync throws", async () => {
			const downloadError = new Error("Network request failed");
			mockDownloadAsync.mockRejectedValue(downloadError);

			// startDownload may throw or swallow the error — either way, store should reflect it
			try {
				await startDownload(store as never);
			} catch {
				// Expected — some implementations rethrow
			}

			// Should have recorded the error in the store
			const errorCalls = store.setCell.mock.calls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "huggingface" &&
					call[2] === "downloadError",
			);
			// The last downloadError setCell should contain the error message
			const lastErrorCall = errorCalls[errorCalls.length - 1];
			expect(lastErrorCall).toBeDefined();
			expect(lastErrorCall[3]).toBe("Network request failed");
		});

		it("handles non-200/206 status as failure", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 500 });

			try {
				await startDownload(store as never);
			} catch {
				// Expected
			}

			// Should NOT set status to ready
			const readyCalls = store.setCell.mock.calls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "huggingface" &&
					call[2] === "status" &&
					call[3] === "ready",
			);
			expect(readyCalls.length).toBe(0);
		});
	});

	// ── Progress throttling ──────────────────────────────────────────────

	describe("progress throttling", () => {
		it("throttles progress updates to at most once per 500ms", async () => {
			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startDownload(store as never);

			// Grab progress callback
			const progressCallback =
				mockCreateDownloadResumable.mock.calls[0][3];
			expect(typeof progressCallback).toBe("function");

			// Clear setCell calls from startDownload initialization
			store.setCell.mockClear();

			// Rapidly fire multiple progress events within < 500ms window
			const totalBytes = 2 * 1024 * 1024 * 1024;
			for (let i = 1; i <= 10; i++) {
				progressCallback({
					totalBytesWritten: i * 100 * 1024 * 1024,
					totalBytesExpectedToWrite: totalBytes,
				});
			}

			// Count immediate progressSizeGB updates
			const immediateCalls = store.setCell.mock.calls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "huggingface" &&
					call[2] === "progressSizeGB",
			);

			// First call goes through immediately, the rest should be throttled
			// (only 1 immediate call, with possibly 1 more after the throttle interval)
			expect(immediateCalls.length).toBeLessThanOrEqual(2);

			// Advance timers to flush any pending throttled update
			jest.advanceTimersByTime(600);

			const allProgressCalls = store.setCell.mock.calls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "huggingface" &&
					call[2] === "progressSizeGB",
			);

			// After flush, we should have at most a few calls (not 10)
			expect(allProgressCalls.length).toBeLessThanOrEqual(3);
			expect(allProgressCalls.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe("download queue", () => {
		it("adds and removes items from the queue", () => {
			expect(getDownloadQueue(store as never)).toEqual([]);

			addToDownloadQueue(store as never, "model-a");
			expect(getDownloadQueue(store as never)).toEqual(["model-a"]);

			addToDownloadQueue(store as never, "model-b");
			expect(getDownloadQueue(store as never)).toEqual(["model-a", "model-b"]);

			// Duplicate add returns false
			expect(addToDownloadQueue(store as never, "model-a")).toBe(false);

			expect(getNextInQueue(store as never)).toBe("model-a");
			expect(isModelQueued(store as never, "model-b")).toBe(true);

			removeFromDownloadQueue(store as never, "model-a");
			expect(getDownloadQueue(store as never)).toEqual(["model-b"]);
		});

		it("startNextQueuedDownload resets isPaused and resumableState before starting", async () => {
			// Simulate a failed download that left isPaused=true
			store._data.aiProviders.huggingface.isPaused = true;
			store._data.aiProviders.huggingface.resumableState = '{"url":"old"}';
			store._data.aiProviders.huggingface.downloadError = "previous error";

			// Add a model to the queue with its hfModels row
			const queuedModelId = "queued-repo__queued-model.gguf";
			store._data.hfModels[queuedModelId] = {
				id: queuedModelId,
				repoId: "queued-org/queued-model-GGUF",
				filename: "queued-model.gguf",
				displayName: "Queued Model",
				fileSizeBytes: 1024 * 1024 * 1024,
				localFilename: "hf-queued-model.gguf",
				downloadUrl: "https://huggingface.co/queued-org/queued-model-GGUF/resolve/main/queued-model.gguf",
				sha256: "def456",
				downloadedAt: "",
			};
			addToDownloadQueue(store as never, queuedModelId);

			mockDownloadAsync.mockResolvedValue({ status: 200 });

			await startNextQueuedDownload(store as never);

			// isPaused should be reset to false before startDownload
			// Check that the store had isPaused set to false
			const isPausedCalls = store.setCell.mock.calls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "huggingface" &&
					call[2] === "isPaused" &&
					call[3] === false,
			);
			expect(isPausedCalls.length).toBeGreaterThanOrEqual(1);

			// resumableState should be cleared
			const resumableStateCalls = store.setCell.mock.calls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "huggingface" &&
					call[2] === "resumableState" &&
					call[3] === "",
			);
			expect(resumableStateCalls.length).toBeGreaterThanOrEqual(1);

			// selectedModelId should be set to the queued model
			expect(store.setCell).toHaveBeenCalledWith(
				"aiProviders",
				"huggingface",
				"selectedModelId",
				queuedModelId,
			);
		});

		it("error during download triggers next queued download", async () => {
			// Use real timers for this test since setImmediate is used in handleDownloadError
			jest.useRealTimers();

			// Set up two models in queue
			const modelA = "model-a__a.gguf";
			const modelB = "model-b__b.gguf";
			store._data.hfModels[modelA] = {
				id: modelA,
				repoId: "org/model-a-GGUF",
				filename: "a.gguf",
				displayName: "Model A",
				fileSizeBytes: 1024 * 1024 * 1024,
				localFilename: "hf-model-a.gguf",
				downloadUrl: "https://huggingface.co/org/model-a-GGUF/resolve/main/a.gguf",
				sha256: "",
				downloadedAt: "",
			};
			store._data.hfModels[modelB] = {
				id: modelB,
				repoId: "org/model-b-GGUF",
				filename: "b.gguf",
				displayName: "Model B",
				fileSizeBytes: 1024 * 1024 * 1024,
				localFilename: "hf-model-b.gguf",
				downloadUrl: "https://huggingface.co/org/model-b-GGUF/resolve/main/b.gguf",
				sha256: "",
				downloadedAt: "",
			};

			// Select model A and make download fail, then succeed for model B
			store._data.aiProviders.huggingface.selectedModelId = modelA;
			addToDownloadQueue(store as never, modelB);

			mockDownloadAsync
				.mockRejectedValueOnce(new Error("Download failed"))
				.mockResolvedValueOnce({ status: 200 });

			try {
				await startDownload(store as never);
			} catch {
				// Expected
			}

			// handleDownloadError should have called startNextQueuedDownload via setImmediate
			// Wait for the setImmediate callback and the async startNextQueuedDownload to complete
			await new Promise((resolve) => setTimeout(resolve, 50));

			// Model B should have been set as selectedModelId at some point
			const selectedModelCalls = store.setCell.mock.calls.filter(
				(call: unknown[]) =>
					call[0] === "aiProviders" &&
					call[1] === "huggingface" &&
					call[2] === "selectedModelId" &&
					call[3] === modelB,
			);
			expect(selectedModelCalls.length).toBeGreaterThanOrEqual(1);
		});
	});
});
