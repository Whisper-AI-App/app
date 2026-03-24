import * as Device from "expo-device";
import { getCredential } from "../../actions/secure-credentials";
import { getPerformanceBadge } from "./performance-badge";
import type {
	HFFileInfo,
	HFModelDetail,
	HFSearchResult,
	HFTreeEntry,
	SearchCacheEntry,
} from "./types";

const HF_API_BASE = "https://huggingface.co/api";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SEARCH_LIMIT = 20;
const MAX_PARAMETER_B = 12;

// In-memory search cache
const searchCache = new Map<string, SearchCacheEntry>();

/**
 * Parse quantization type from a GGUF filename.
 */
export function parseQuantization(filename: string): string {
	const match = filename.match(
		/[_-]((?:I?Q\d+_(?:K_[SML]|[A-Z0-9]+)|[BF](?:16|32)))/i,
	);
	return match ? match[1] : "";
}

/**
 * Get auth headers if HF token is configured.
 */
async function getHeaders(): Promise<Record<string, string>> {
	const headers: Record<string, string> = {
		Accept: "application/json",
	};
	const token = await getCredential("huggingface", "apiToken");
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}
	return headers;
}

/**
 * Parse rate limit retry seconds from 429 response.
 * Header format: "api";r=450;t=120
 */
function parseRateLimitRetrySeconds(response: Response): number {
	const header = response.headers.get("RateLimit");
	if (!header) return 60; // default 60s
	const match = header.match(/t=(\d+)/);
	return match ? Number.parseInt(match[1], 10) : 60;
}

/**
 * Handle HTTP error responses.
 */
async function handleResponse(response: Response): Promise<void> {
	if (response.ok) return;

	if (response.status === 429) {
		const retrySeconds = parseRateLimitRetrySeconds(response);
		throw new Error(
			`Rate limited. Try again in ${retrySeconds}s. Add a Hugging Face token for higher limits.`,
		);
	}

	if (response.status === 401) {
		throw new Error(
			"This model requires a Hugging Face account. Add your token in settings.",
		);
	}

	if (response.status >= 500) {
		throw new Error("Hugging Face is temporarily unavailable. Try again later.");
	}

	throw new Error(`HF API error: ${response.status} ${response.statusText}`);
}

/**
 * Get cached search results or null if expired/missing.
 */
function getCachedResults(cacheKey: string): HFSearchResult[] | null {
	const entry = searchCache.get(cacheKey);
	if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
		return entry.data;
	}
	searchCache.delete(cacheKey);
	return null;
}

/**
 * Clear the in-memory search cache.
 */
export function clearSearchCache(): void {
	searchCache.clear();
}

const SUPPORTED_PIPELINE_TAGS = ["text-generation", "image-text-to-text"];

/**
 * Search HF Hub for GGUF models matching a single pipeline tag.
 */
async function searchModelsByPipeline(
	query: string,
	pipelineTag: string,
): Promise<HFSearchResult[]> {
	const params = new URLSearchParams({
		filter: "gguf",
		pipeline_tag: pipelineTag,
		search: query,
		sort: "downloads",
		direction: "-1",
		limit: String(SEARCH_LIMIT),
	});

	const headers = await getHeaders();
	const response = await fetch(`${HF_API_BASE}/models?${params}`, { headers });
	await handleResponse(response);

	const data = (await response.json()) as Array<{
		id: string;
		author?: string;
		pipeline_tag: string;
		downloads: number;
		likes: number;
		tags: string[];
		lastModified?: string;
	}>;

	return data.map((item) => ({
		repoId: item.id,
		author: item.author ?? item.id.split("/")[0] ?? "",
		pipelineTag: item.pipeline_tag,
		downloads: item.downloads,
		likes: item.likes,
		tags: item.tags ?? [],
		lastModified: item.lastModified ?? "",
	}));
}

/**
 * Search HF Hub for GGUF models across supported pipeline tags.
 */
export async function searchModels(query: string): Promise<HFSearchResult[]> {
	const cacheKey = `${query}:${SUPPORTED_PIPELINE_TAGS.join(",")}`;
	const cached = getCachedResults(cacheKey);
	if (cached) return cached;

	const allResults = await Promise.all(
		SUPPORTED_PIPELINE_TAGS.map((tag) => searchModelsByPipeline(query, tag)),
	);

	// Merge, deduplicate by repoId, sort by downloads
	const seen = new Set<string>();
	const results: HFSearchResult[] = [];
	for (const item of allResults.flat()) {
		if (!seen.has(item.repoId)) {
			seen.add(item.repoId);
			results.push(item);
		}
	}
	results.sort((a, b) => b.downloads - a.downloads);

	searchCache.set(cacheKey, {
		key: cacheKey,
		data: results,
		timestamp: Date.now(),
	});

	return results;
}

/**
 * Get the default branch for a repository.
 * Fetches from the model info API and defaults to 'main' if not found.
 * Used as a fallback when branch info isn't available from cached data.
 */
async function getDefaultBranch(repoId: string): Promise<string> {
	const headers = await getHeaders();
	try {
		const response = await fetch(`${HF_API_BASE}/models/${repoId}`, { headers });
		if (response.ok) {
			const data = (await response.json()) as { defaultBranch?: string };
			return data.defaultBranch ?? "main";
		}
	} catch {
		// Fall through to default
	}
	return "main";
}

/**
 * Get detailed model information.
 */
export async function getModelInfo(repoId: string): Promise<HFModelDetail> {
	const headers = await getHeaders();
	const response = await fetch(`${HF_API_BASE}/models/${repoId}`, { headers });
	await handleResponse(response);

	const data = (await response.json()) as {
		id: string;
		author: string;
		pipeline_tag: string;
		gated: boolean | string;
		cardData?: {
			license?: string;
			model_name?: string;
		};
		config?: {
			architectures?: string[];
			max_position_embeddings?: number;
		};
		gguf?: {
			architecture: string;
			context_length: number;
			total: number;
		};
		siblings?: Array<{ rfilename: string }>;
		defaultBranch?: string;
	};

	// Also fetch files for size info
	const files = await listFiles(repoId, data.defaultBranch);

	const architecture =
		data.gguf?.architecture ??
		data.config?.architectures?.[0] ??
		"";
	const contextLength =
		data.gguf?.context_length ??
		data.config?.max_position_embeddings ??
		0;

	return {
		repoId: data.id,
		author: data.author,
		description: data.cardData?.model_name ?? data.id.split("/").pop() ?? "",
		license: data.cardData?.license ?? "",
		architecture,
		contextLength,
		pipelineTag: data.pipeline_tag,
		gated: !!data.gated,
		files,
	};
}

/**
 * List GGUF files in a model repository.
 * @param repoId - The model repository ID (e.g., "username/model-name")
 * @param branch - The git branch to fetch files from. When omitted, the repo's default branch is auto-detected.
 */
export async function listFiles(repoId: string, branch?: string): Promise<HFFileInfo[]> {
	const resolvedBranch = branch ?? await getDefaultBranch(repoId);
	const headers = await getHeaders();
	const response = await fetch(
		`${HF_API_BASE}/models/${repoId}/tree/${resolvedBranch}`,
		{ headers },
	);
	await handleResponse(response);

	const entries = (await response.json()) as HFTreeEntry[];
	const deviceRAMBytes = Device.totalMemory ?? 4 * 1024 * 1024 * 1024;

	return entries
		.filter((entry) => entry.type === "file" && entry.path.endsWith(".gguf") && !entry.path.toLowerCase().includes("mmproj"))
		.map((entry) => ({
			filename: entry.path,
			sizeBytes: entry.size,
			sha256: entry.lfs?.oid ?? "",
			quantization: parseQuantization(entry.path),
			performanceTier: getPerformanceBadge(deviceRAMBytes, entry.size),
			// Add ?download=true for direct LFS downloads and use the correct branch
			downloadUrl: `https://huggingface.co/${repoId}/resolve/${resolvedBranch}/${entry.path}?download=true`,
		}));
}

/**
 * Detect the mmproj (multimodal projection) file in a model repository.
 * Vision GGUF models require a separate mmproj file for image understanding.
 * Returns metadata about the mmproj file if found, null otherwise.
 */
export async function detectMmprojFile(
	repoId: string,
	branch?: string,
): Promise<{ filename: string; sizeBytes: number; downloadUrl: string } | null> {
	const resolvedBranch = branch ?? await getDefaultBranch(repoId);
	const headers = await getHeaders();
	const response = await fetch(
		`${HF_API_BASE}/models/${repoId}/tree/${resolvedBranch}`,
		{ headers },
	);
	await handleResponse(response);

	const entries = (await response.json()) as HFTreeEntry[];

	const mmprojEntry = entries.find(
		(entry) =>
			entry.type === "file" &&
			entry.path.endsWith(".gguf") &&
			entry.path.toLowerCase().includes("mmproj"),
	);

	if (!mmprojEntry) return null;

	return {
		filename: mmprojEntry.path,
		sizeBytes: mmprojEntry.size,
		downloadUrl: `https://huggingface.co/${repoId}/resolve/${resolvedBranch}/${mmprojEntry.path}?download=true`,
	};
}
