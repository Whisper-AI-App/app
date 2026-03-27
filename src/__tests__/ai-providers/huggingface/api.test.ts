jest.mock("expo-secure-store");
jest.mock("expo-device", () => ({
	totalMemory: 8 * 1024 * 1024 * 1024,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import * as SecureStore from "expo-secure-store";
import {
	searchModels,
	getModelInfo,
	listFiles,
	clearSearchCache,
	parseQuantization,
	detectMmprojFile,
} from "@/src/ai-providers/huggingface/api";
import type {
	HFSearchResult,
	HFModelDetail,
	HFFileInfo,
} from "@/src/ai-providers/huggingface/types";

// ─── Helpers ───────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>) {
	return Promise.resolve({
		ok: status >= 200 && status < 300,
		status,
		headers: new Headers(headers ?? {}),
		json: () => Promise.resolve(body),
	} as Response);
}

function errorResponse(status: number, body?: unknown, headers?: Record<string, string>) {
	return Promise.resolve({
		ok: false,
		status,
		statusText: status === 429 ? "Too Many Requests" : "Error",
		headers: new Headers(headers ?? {}),
		json: () => Promise.resolve(body ?? {}),
		text: () => Promise.resolve(JSON.stringify(body ?? {})),
	} as Response);
}

// ─── Mock HF API Data ──────────────────────────────────────

const MOCK_HF_SEARCH_RESPONSE = [
	{
		id: "TheBloke/Llama-2-7B-GGUF",
		author: "TheBloke",
		pipeline_tag: "text-generation",
		downloads: 500000,
		likes: 1200,
		tags: ["gguf", "llama", "text-generation"],
		lastModified: "2024-06-15T10:00:00.000Z",
	},
	{
		id: "bartowski/Qwen3-0.6B-GGUF",
		author: "bartowski",
		pipeline_tag: "text-generation",
		downloads: 120000,
		likes: 340,
		tags: ["gguf", "qwen", "text-generation"],
		lastModified: "2024-07-01T08:30:00.000Z",
	},
];

const MOCK_HF_MODEL_INFO_RESPONSE = {
	id: "TheBloke/Llama-2-7B-GGUF",
	author: "TheBloke",
	description: "GGUF quantizations of Llama 2 7B",
	cardData: {
		license: "llama2",
	},
	config: {
		architectures: ["LlamaForCausalLM"],
		max_position_embeddings: 4096,
	},
	pipeline_tag: "text-generation",
	gated: false,
	siblings: [
		{
			rfilename: "llama-2-7b.Q4_K_M.gguf",
			size: 4368438272,
			lfs: {
				oid: "abc123sha256hash",
				size: 4368438272,
				pointerSize: 134,
			},
		},
		{
			rfilename: "llama-2-7b.Q5_K_M.gguf",
			size: 5130000000,
			lfs: {
				oid: "def456sha256hash",
				size: 5130000000,
				pointerSize: 134,
			},
		},
		{
			rfilename: "README.md",
			size: 5000,
		},
		{
			rfilename: "config.json",
			size: 800,
		},
	],
};

const MOCK_HF_GATED_MODEL_RESPONSE = {
	id: "meta-llama/Llama-3-8B-GGUF",
	author: "meta-llama",
	description: "Llama 3 8B model",
	cardData: {
		license: "llama3",
	},
	config: {
		architectures: ["LlamaForCausalLM"],
		max_position_embeddings: 8192,
	},
	pipeline_tag: "text-generation",
	gated: "auto",
	siblings: [
		{
			rfilename: "llama-3-8b.Q4_K_M.gguf",
			size: 4900000000,
			lfs: {
				oid: "gated-sha256-hash",
				size: 4900000000,
				pointerSize: 134,
			},
		},
	],
};

const MOCK_HF_TREE_RESPONSE = [
	{
		type: "file",
		oid: "oid1",
		size: 4368438272,
		path: "llama-2-7b.Q4_K_M.gguf",
		lfs: {
			oid: "abc123sha256hash",
			size: 4368438272,
			pointerSize: 134,
		},
	},
	{
		type: "file",
		oid: "oid2",
		size: 5130000000,
		path: "llama-2-7b.Q5_K_M.gguf",
		lfs: {
			oid: "def456sha256hash",
			size: 5130000000,
			pointerSize: 134,
		},
	},
	{
		type: "file",
		oid: "oid3",
		size: 5000,
		path: "README.md",
	},
	{
		type: "file",
		oid: "oid4",
		size: 800,
		path: "config.json",
	},
	{
		type: "directory",
		oid: "dir1",
		size: 0,
		path: ".cache",
	},
];

// ─── Tests ─────────────────────────────────────────────────

const { __resetStore } = SecureStore as typeof SecureStore & {
	__resetStore: () => void;
};

describe("HuggingFace API client", () => {
	beforeEach(() => {
		mockFetch.mockReset();
		clearSearchCache();
		__resetStore();
		jest.clearAllMocks();
	});

	// ─── searchModels ──────────────────────────────────────────

	describe("searchModels", () => {
		it("returns mapped search results on success", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse(MOCK_HF_SEARCH_RESPONSE))
				.mockReturnValueOnce(jsonResponse([]));

			const results = await searchModels("llama");

			expect(results).toHaveLength(2);
			expect(results[0]).toEqual(
				expect.objectContaining({
					repoId: "TheBloke/Llama-2-7B-GGUF",
					author: "TheBloke",
					pipelineTag: "text-generation",
					downloads: 500000,
					likes: 1200,
					tags: expect.arrayContaining(["gguf", "llama"]),
				}),
			);
			expect(results[1]).toEqual(
				expect.objectContaining({
					repoId: "bartowski/Qwen3-0.6B-GGUF",
					author: "bartowski",
				}),
			);
		});

		it("searches both text-generation and image-text-to-text pipelines", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse(MOCK_HF_SEARCH_RESPONSE))
				.mockReturnValueOnce(jsonResponse([]));

			await searchModels("llama");

			expect(mockFetch).toHaveBeenCalledTimes(2);
			const url0 = mockFetch.mock.calls[0][0] as string;
			const url1 = mockFetch.mock.calls[1][0] as string;
			const urls = [url0, url1];
			expect(urls).toEqual(
				expect.arrayContaining([
					expect.stringContaining("pipeline_tag=text-generation"),
					expect.stringContaining("pipeline_tag=image-text-to-text"),
				]),
			);
			for (const url of urls) {
				expect(url).toContain("filter=gguf");
				expect(url).toContain("search=llama");
			}
		});

		it("deduplicates results across pipeline tags", async () => {
			const duplicate = { ...MOCK_HF_SEARCH_RESPONSE[0] };
			mockFetch
				.mockReturnValueOnce(jsonResponse(MOCK_HF_SEARCH_RESPONSE))
				.mockReturnValueOnce(jsonResponse([duplicate]));

			const results = await searchModels("llama");

			const repoIds = results.map((r) => r.repoId);
			expect(new Set(repoIds).size).toBe(repoIds.length);
		});

		it("returns empty array when no results", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse([]))
				.mockReturnValueOnce(jsonResponse([]));

			const results = await searchModels("nonexistent-model-xyz");

			expect(results).toEqual([]);
		});

		it("caches results within 5 minutes (second call does not re-fetch)", async () => {
			jest.useFakeTimers();
			mockFetch
				.mockReturnValueOnce(jsonResponse(MOCK_HF_SEARCH_RESPONSE))
				.mockReturnValueOnce(jsonResponse([]));

			const first = await searchModels("llama");
			const second = await searchModels("llama");

			expect(mockFetch).toHaveBeenCalledTimes(2); // 2 pipeline tags, 1 search call
			expect(second).toEqual(first);
			jest.useRealTimers();
		});

		it("re-fetches after cache TTL expires (5 min)", async () => {
			jest.useFakeTimers();
			mockFetch
				.mockReturnValueOnce(jsonResponse(MOCK_HF_SEARCH_RESPONSE))
				.mockReturnValueOnce(jsonResponse([]))
				.mockReturnValueOnce(jsonResponse([]))
				.mockReturnValueOnce(jsonResponse([]));

			await searchModels("llama");

			// Advance past 5-minute TTL
			jest.advanceTimersByTime(5 * 60 * 1000 + 1);

			const stale = await searchModels("llama");

			expect(mockFetch).toHaveBeenCalledTimes(4); // 2 per search call
			expect(stale).toEqual([]);
			jest.useRealTimers();
		});

		it("injects Authorization header when HF token is present", async () => {
			await SecureStore.setItemAsync("credential_huggingface_apiToken", "hf_test_token_123");
			mockFetch
				.mockReturnValueOnce(jsonResponse(MOCK_HF_SEARCH_RESPONSE))
				.mockReturnValueOnce(jsonResponse([]));

			await searchModels("llama");

			const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
			expect(fetchOptions.headers).toEqual(
				expect.objectContaining({
					Authorization: "Bearer hf_test_token_123",
				}),
			);
		});

		it("does not include Authorization header when no token", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse(MOCK_HF_SEARCH_RESPONSE))
				.mockReturnValueOnce(jsonResponse([]));

			await searchModels("llama");

			const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit | undefined;
			const headers = fetchOptions?.headers as Record<string, string> | undefined;
			if (headers) {
				expect(headers.Authorization).toBeUndefined();
			}
		});
	});

	// ─── getModelInfo ──────────────────────────────────────────

	describe("getModelInfo", () => {
		it("returns model detail with GGUF metadata", async () => {
			// getModelInfo calls fetch: model info, then listFiles auto-detects branch + tree listing
			mockFetch
				.mockReturnValueOnce(jsonResponse(MOCK_HF_MODEL_INFO_RESPONSE))
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const detail = await getModelInfo("TheBloke/Llama-2-7B-GGUF");

			expect(detail.repoId).toBe("TheBloke/Llama-2-7B-GGUF");
			expect(detail.author).toBe("TheBloke");
			expect(detail.pipelineTag).toBe("text-generation");
			expect(detail.gated).toBe(false);

			// Should only include .gguf files from tree listing
			expect(detail.files.length).toBe(2);
			expect(detail.files[0].filename).toBe("llama-2-7b.Q4_K_M.gguf");
			expect(detail.files[0].sizeBytes).toBe(4368438272);
			expect(detail.files[0].sha256).toBe("abc123sha256hash");
			expect(detail.files[1].filename).toBe("llama-2-7b.Q5_K_M.gguf");
		});

		it("handles gated models (gated field is truthy)", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse(MOCK_HF_GATED_MODEL_RESPONSE))
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse([
					{
						type: "file",
						oid: "oid1",
						size: 4900000000,
						path: "llama-3-8b.Q4_K_M.gguf",
						lfs: { oid: "gated-sha256-hash", size: 4900000000, pointerSize: 134 },
					},
				]));

			const detail = await getModelInfo("meta-llama/Llama-3-8B-GGUF");

			expect(detail.gated).toBe(true);
			expect(detail.files).toHaveLength(1);
		});

		it("uses defaultBranch from model info when available", async () => {
			const modelWithCustomBranch = {
				...MOCK_HF_MODEL_INFO_RESPONSE,
				defaultBranch: "gguf",
			};
			mockFetch
				.mockReturnValueOnce(jsonResponse(modelWithCustomBranch))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			await getModelInfo("TheBloke/Llama-2-7B-GGUF");

			// Second call should use the custom branch from defaultBranch field
			const treeUrl = mockFetch.mock.calls[1][0] as string;
			expect(treeUrl).toContain("/tree/gguf");
		});

		it("falls back to main branch when defaultBranch is not provided", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse(MOCK_HF_MODEL_INFO_RESPONSE))
				// listFiles receives undefined branch, so getDefaultBranch fires
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			await getModelInfo("TheBloke/Llama-2-7B-GGUF");

			// Third call (tree listing) should use main branch
			const treeUrl = mockFetch.mock.calls[2][0] as string;
			expect(treeUrl).toContain("/tree/main");
		});
	});

	// ─── listFiles ─────────────────────────────────────────────

	describe("listFiles", () => {
		it("filters for .gguf files only", async () => {
			// First call: getDefaultBranch (model info), second call: tree listing
			mockFetch
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const files = await listFiles("TheBloke/Llama-2-7B-GGUF");

			expect(files).toHaveLength(2);
			expect(files.every((f) => f.filename.endsWith(".gguf"))).toBe(true);
			expect(files.map((f) => f.filename)).toEqual([
				"llama-2-7b.Q4_K_M.gguf",
				"llama-2-7b.Q5_K_M.gguf",
			]);
		});

		it("extracts LFS SHA256 from lfs.oid", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const files = await listFiles("TheBloke/Llama-2-7B-GGUF");

			expect(files[0].sha256).toBe("abc123sha256hash");
			expect(files[1].sha256).toBe("def456sha256hash");
		});

		it("includes sizeBytes from tree entry", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const files = await listFiles("TheBloke/Llama-2-7B-GGUF");

			expect(files[0].sizeBytes).toBe(4368438272);
			expect(files[1].sizeBytes).toBe(5130000000);
		});

		it("includes downloadUrl for each file with download=true query param", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const files = await listFiles("TheBloke/Llama-2-7B-GGUF");

			for (const file of files) {
				expect(file.downloadUrl).toContain("TheBloke/Llama-2-7B-GGUF");
				expect(file.downloadUrl).toContain(file.filename);
				// Verify the ?download=true parameter is included for direct LFS downloads
				expect(file.downloadUrl).toContain("?download=true");
			}
		});

		it("includes performanceTier based on device RAM", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const files = await listFiles("TheBloke/Llama-2-7B-GGUF");

			// With 8GB RAM and ~4.07GB file: ratio ~1.97 -> "Poorly"
			// With 8GB RAM and ~4.78GB file: ratio ~1.67 -> "Poorly"
			for (const file of files) {
				expect(["Very Well", "Well", "Okay", "Poorly", "Badly"]).toContain(
					file.performanceTier,
				);
			}
		});

		it("uses the correct branch parameter when fetching files", async () => {
			mockFetch.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			await listFiles("TheBloke/Llama-2-7B-GGUF", "main");

			const fetchUrl = mockFetch.mock.calls[0][0] as string;
			expect(fetchUrl).toContain("/tree/main");
		});

		it("uses custom branch parameter when provided", async () => {
			mockFetch.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			await listFiles("TheBloke/Llama-2-7B-GGUF", "gguf");

			const fetchUrl = mockFetch.mock.calls[0][0] as string;
			expect(fetchUrl).toContain("/tree/gguf");
		});

		it("auto-detects default branch when no branch parameter is provided", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "gguf" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const files = await listFiles("TheBloke/Llama-2-7B-GGUF");

			// First call should be getDefaultBranch (model info endpoint)
			const branchUrl = mockFetch.mock.calls[0][0] as string;
			expect(branchUrl).toContain("/models/TheBloke/Llama-2-7B-GGUF");
			// Second call should use the auto-detected branch
			const treeUrl = mockFetch.mock.calls[1][0] as string;
			expect(treeUrl).toContain("/tree/gguf");
			// Download URLs should also use the auto-detected branch
			for (const file of files) {
				expect(file.downloadUrl).toContain("/resolve/gguf/");
			}
		});

		it("falls back to main when getDefaultBranch API fails", async () => {
			mockFetch
				.mockReturnValueOnce(errorResponse(500))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const files = await listFiles("TheBloke/Llama-2-7B-GGUF");

			// Should fall back to "main" when the model info request fails
			const treeUrl = mockFetch.mock.calls[1][0] as string;
			expect(treeUrl).toContain("/tree/main");
			expect(files).toHaveLength(2);
		});
	});

	// ─── Rate Limiting ─────────────────────────────────────────

	describe("rate limiting (429)", () => {
		it("throws error with retry seconds parsed from RateLimit header", async () => {
			mockFetch.mockReturnValueOnce(
				errorResponse(429, { error: "Too many requests" }, {
					RateLimit: '"api";r=450;t=120',
				}),
			);

			await expect(searchModels("llama")).rejects.toThrow(/120/);
		});

		it("throws on 429 for getModelInfo", async () => {
			mockFetch.mockReturnValueOnce(
				errorResponse(429, { error: "Too many requests" }, {
					RateLimit: '"api";r=450;t=60',
				}),
			);

			await expect(getModelInfo("TheBloke/Llama-2-7B-GGUF")).rejects.toThrow();
		});

		it("throws on 429 for listFiles", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(
					errorResponse(429, { error: "Too many requests" }, {
						RateLimit: '"api";r=450;t=30',
					}),
				);

			await expect(listFiles("TheBloke/Llama-2-7B-GGUF")).rejects.toThrow();
		});
	});

	// ─── Network Errors ────────────────────────────────────────

	describe("network error handling", () => {
		it("throws when fetch rejects (network failure) in searchModels", async () => {
			mockFetch.mockRejectedValueOnce(new TypeError("Network request failed"));

			await expect(searchModels("llama")).rejects.toThrow("Network request failed");
		});

		it("throws when fetch rejects (network failure) in getModelInfo", async () => {
			mockFetch.mockRejectedValueOnce(new TypeError("Network request failed"));

			await expect(getModelInfo("TheBloke/Llama-2-7B-GGUF")).rejects.toThrow(
				"Network request failed",
			);
		});

		it("throws when fetch rejects (network failure) in listFiles", async () => {
			// getDefaultBranch swallows its own fetch error and falls back to "main",
			// so the second fetch (tree listing) is the one that surfaces the network failure
			mockFetch
				.mockRejectedValueOnce(new TypeError("Network request failed"))
				.mockRejectedValueOnce(new TypeError("Network request failed"));

			await expect(listFiles("TheBloke/Llama-2-7B-GGUF")).rejects.toThrow(
				"Network request failed",
			);
		});

		it("throws on non-200 HTTP status (e.g. 500)", async () => {
			mockFetch
				.mockReturnValueOnce(errorResponse(500, { error: "Internal server error" }))
				.mockReturnValueOnce(errorResponse(500, { error: "Internal server error" }));

			await expect(searchModels("llama")).rejects.toThrow();
		});

		it("throws on 404 for getModelInfo", async () => {
			mockFetch.mockReturnValueOnce(errorResponse(404, { error: "Model not found" }));

			await expect(getModelInfo("nonexistent/model")).rejects.toThrow();
		});
	});

	// ─── clearSearchCache ──────────────────────────────────────

	describe("clearSearchCache", () => {
		it("forces re-fetch after cache is cleared", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse(MOCK_HF_SEARCH_RESPONSE))
				.mockReturnValueOnce(jsonResponse([]))
				.mockReturnValueOnce(jsonResponse([]))
				.mockReturnValueOnce(jsonResponse([]));

			await searchModels("llama");
			clearSearchCache();
			const afterClear = await searchModels("llama");

			expect(mockFetch).toHaveBeenCalledTimes(4); // 2 pipeline tags × 2 searches
			expect(afterClear).toEqual([]);
		});
	});

	// ─── parseQuantization ─────────────────────────────────────

	describe("parseQuantization", () => {
		it("parses standard K-quant types (Q4_K_M, Q5_K_S, Q6_K_L)", () => {
			expect(parseQuantization("llama-2-7b-Q4_K_M.gguf")).toBe("Q4_K_M");
			expect(parseQuantization("model-Q5_K_S.gguf")).toBe("Q5_K_S");
			expect(parseQuantization("model-Q6_K_L.gguf")).toBe("Q6_K_L");
		});

		it("parses non-K quant types (Q4_0, Q8_0)", () => {
			expect(parseQuantization("model-Q4_0.gguf")).toBe("Q4_0");
			expect(parseQuantization("model-Q8_0.gguf")).toBe("Q8_0");
		});

		it("parses imatrix quant types (IQ4_XS, IQ3_XXS)", () => {
			expect(parseQuantization("model-IQ4_XS.gguf")).toBe("IQ4_XS");
			expect(parseQuantization("model-IQ3_XXS.gguf")).toBe("IQ3_XXS");
		});

		it("parses unquantized float types (F16, F32)", () => {
			expect(parseQuantization("model-F16.gguf")).toBe("F16");
			expect(parseQuantization("model-F32.gguf")).toBe("F32");
		});

		it("parses BFloat types (B16, B32)", () => {
			expect(parseQuantization("model-B16.gguf")).toBe("B16");
			expect(parseQuantization("model-B32.gguf")).toBe("B32");
		});

		it("returns empty string when no quantization pattern is found", () => {
			expect(parseQuantization("README.md")).toBe("");
			expect(parseQuantization("config.json")).toBe("");
			expect(parseQuantization("model.gguf")).toBe("");
		});

		it("handles underscore separator before quant type", () => {
			expect(parseQuantization("llama_2_7b_Q4_K_M.gguf")).toBe("Q4_K_M");
		});

		it("handles hyphen separator before quant type", () => {
			expect(parseQuantization("llama-2-7b-Q4_K_M.gguf")).toBe("Q4_K_M");
		});

		it("is case insensitive for the quant pattern", () => {
			expect(parseQuantization("model-q4_k_m.gguf")).toBe("q4_k_m");
			expect(parseQuantization("model-f16.gguf")).toBe("f16");
		});
	});

	// ─── getModelInfo: architecture and contextLength ──────────

	describe("getModelInfo parameter count / architecture detection", () => {
		it("returns architecture and contextLength from gguf fields when present", async () => {
			const modelResponse = {
				...MOCK_HF_MODEL_INFO_RESPONSE,
				gguf: {
					architecture: "qwen2",
					context_length: 32768,
					total: 600000000,
				},
				config: {
					architectures: ["Qwen2ForCausalLM"],
					max_position_embeddings: 4096,
				},
			};
			mockFetch
				.mockReturnValueOnce(jsonResponse(modelResponse))
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const detail = await getModelInfo("TheBloke/Llama-2-7B-GGUF");

			expect(detail.architecture).toBe("qwen2");
			expect(detail.contextLength).toBe(32768);
		});

		it("falls back to config.architectures and config.max_position_embeddings when gguf is absent", async () => {
			const modelResponse = {
				...MOCK_HF_MODEL_INFO_RESPONSE,
				gguf: undefined,
				config: {
					architectures: ["LlamaForCausalLM"],
					max_position_embeddings: 4096,
				},
			};
			mockFetch
				.mockReturnValueOnce(jsonResponse(modelResponse))
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const detail = await getModelInfo("TheBloke/Llama-2-7B-GGUF");

			expect(detail.architecture).toBe("LlamaForCausalLM");
			expect(detail.contextLength).toBe(4096);
		});

		it("returns empty architecture and zero contextLength when both gguf and config are absent", async () => {
			const modelResponse = {
				...MOCK_HF_MODEL_INFO_RESPONSE,
				gguf: undefined,
				config: undefined,
			};
			mockFetch
				.mockReturnValueOnce(jsonResponse(modelResponse))
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const detail = await getModelInfo("TheBloke/Llama-2-7B-GGUF");

			expect(detail.architecture).toBe("");
			expect(detail.contextLength).toBe(0);
		});

		it("prefers gguf.architecture over config.architectures[0]", async () => {
			const modelResponse = {
				...MOCK_HF_MODEL_INFO_RESPONSE,
				gguf: {
					architecture: "mistral",
					context_length: 16384,
					total: 7000000000,
				},
				config: {
					architectures: ["MistralForCausalLM"],
					max_position_embeddings: 8192,
				},
			};
			mockFetch
				.mockReturnValueOnce(jsonResponse(modelResponse))
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const detail = await getModelInfo("TheBloke/Llama-2-7B-GGUF");

			expect(detail.architecture).toBe("mistral");
			expect(detail.contextLength).toBe(16384);
		});

		it("falls back to config when gguf fields are partially missing", async () => {
			const modelResponse = {
				...MOCK_HF_MODEL_INFO_RESPONSE,
				gguf: {
					total: 3000000000,
				},
				config: {
					architectures: ["PhiForCausalLM"],
					max_position_embeddings: 2048,
				},
			};
			mockFetch
				.mockReturnValueOnce(jsonResponse(modelResponse))
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const detail = await getModelInfo("TheBloke/Llama-2-7B-GGUF");

			expect(detail.architecture).toBe("PhiForCausalLM");
			expect(detail.contextLength).toBe(2048);
		});
	});

	// ─── mmproj detection ─────────────────────────────────────

	describe("mmproj", () => {
		const TREE_WITH_MMPROJ = [
			...MOCK_HF_TREE_RESPONSE,
			{
				type: "file",
				oid: "oid3",
				size: 851000000,
				path: "mmproj-model-f16.gguf",
				lfs: {
					oid: "mmproj_sha256",
					size: 851000000,
					pointerSize: 134,
				},
			},
		];

		it("listFiles excludes mmproj files", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(TREE_WITH_MMPROJ));

			const files = await listFiles("org/vision-model-GGUF");

			expect(files.every((f) => !f.filename.toLowerCase().includes("mmproj"))).toBe(true);
			expect(files).toHaveLength(2);
		});

		it("detectMmprojFile returns mmproj metadata when found", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(TREE_WITH_MMPROJ));

			const result = await detectMmprojFile("org/vision-model-GGUF");

			expect(result).not.toBeNull();
			expect(result!.filename).toBe("mmproj-model-f16.gguf");
			expect(result!.sizeBytes).toBe(851000000);
			expect(result!.downloadUrl).toContain("mmproj-model-f16.gguf");
			expect(result!.downloadUrl).toContain("?download=true");
		});

		it("detectMmprojFile returns null when no mmproj found", async () => {
			mockFetch
				.mockReturnValueOnce(jsonResponse({ defaultBranch: "main" }))
				.mockReturnValueOnce(jsonResponse(MOCK_HF_TREE_RESPONSE));

			const result = await detectMmprojFile("TheBloke/Llama-2-7B-GGUF");

			expect(result).toBeNull();
		});

		it("detectMmprojFile uses provided branch", async () => {
			mockFetch.mockReturnValueOnce(jsonResponse(TREE_WITH_MMPROJ));

			await detectMmprojFile("org/vision-model-GGUF", "gguf");

			const fetchUrl = mockFetch.mock.calls[0][0] as string;
			expect(fetchUrl).toContain("/tree/gguf");
		});
	});
});
