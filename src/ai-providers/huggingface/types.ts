/**
 * HuggingFace provider-specific types.
 */

// ─── Performance Badge ──────────────────────────────────────

export type PerformanceTier =
	| "Very Well"
	| "Well"
	| "Okay"
	| "Poorly"
	| "Badly";

// ─── HF Hub API Response Types ──────────────────────────────

export interface HFSearchResult {
	repoId: string;
	author: string;
	pipelineTag: string;
	downloads: number;
	likes: number;
	tags: string[];
	lastModified: string;
}

export interface HFModelDetail {
	repoId: string;
	author: string;
	description: string;
	license: string;
	architecture: string;
	contextLength: number;
	pipelineTag: string;
	gated: boolean;
	files: HFFileInfo[];
}

export interface HFFileInfo {
	filename: string;
	sizeBytes: number;
	sha256: string;
	quantization: string;
	performanceTier: PerformanceTier;
	downloadUrl: string;
}

export interface HFTreeEntry {
	type: "file" | "directory";
	oid: string;
	size: number;
	path: string;
	lfs?: {
		oid: string;
		size: number;
		pointerSize: number;
	};
}

// ─── Featured Models ────────────────────────────────────────

export interface FeaturedModel {
	repoId: string;
	filename: string;
	displayName: string;
	description: string;
	fileSizeBytes: number;
	parametersB: number;
	quantization: string;
	pipelineTag: string;
	sha256: string;
	downloadUrl: string;
	mmprojFilename?: string;
	mmprojSizeBytes?: number;
	mmprojDownloadUrl?: string;
	contextLength?: number;
}

// ─── Search Cache ───────────────────────────────────────────

export interface SearchCacheEntry {
	key: string;
	data: HFSearchResult[];
	timestamp: number;
}
