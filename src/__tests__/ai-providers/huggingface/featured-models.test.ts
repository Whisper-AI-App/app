import { FEATURED_MODELS } from "@/src/ai-providers/huggingface/featured-models";
import type { FeaturedModel } from "@/src/ai-providers/huggingface/types";

describe("FEATURED_MODELS", () => {
	it("has exactly 6 entries (4 text + 2 vision)", () => {
		expect(FEATURED_MODELS.length).toBeGreaterThan(0);
		expect(FEATURED_MODELS.length).toBe(6);
	});

	describe("structure validation", () => {
		it.each(FEATURED_MODELS)(
			"$displayName has all required fields",
			(model: FeaturedModel) => {
				expect(model).toHaveProperty("repoId");
				expect(model).toHaveProperty("filename");
				expect(model).toHaveProperty("displayName");
				expect(model).toHaveProperty("description");
				expect(model).toHaveProperty("fileSizeBytes");
				expect(model).toHaveProperty("parametersB");
				expect(model).toHaveProperty("quantization");
				expect(model).toHaveProperty("pipelineTag");
				expect(model).toHaveProperty("sha256");
				expect(model).toHaveProperty("downloadUrl");
			},
		);

		it.each(FEATURED_MODELS)(
			"$displayName has correct field types",
			(model: FeaturedModel) => {
				expect(typeof model.repoId).toBe("string");
				expect(typeof model.filename).toBe("string");
				expect(typeof model.displayName).toBe("string");
				expect(typeof model.description).toBe("string");
				expect(typeof model.fileSizeBytes).toBe("number");
				expect(typeof model.parametersB).toBe("number");
				expect(typeof model.quantization).toBe("string");
				expect(typeof model.pipelineTag).toBe("string");
				expect(typeof model.sha256).toBe("string");
				expect(typeof model.downloadUrl).toBe("string");
			},
		);
	});

	describe("filename validation", () => {
		it.each(FEATURED_MODELS)(
			'$displayName filename "$filename" ends with .gguf',
			(model: FeaturedModel) => {
				expect(model.filename).toMatch(/\.gguf$/);
			},
		);
	});

	describe("repoId validation", () => {
		it.each(FEATURED_MODELS)(
			'$displayName repoId "$repoId" contains exactly one "/"',
			(model: FeaturedModel) => {
				const slashCount = (model.repoId.match(/\//g) || []).length;
				expect(slashCount).toBe(1);
			},
		);

		it.each(FEATURED_MODELS)(
			'$displayName repoId "$repoId" has non-empty namespace and repo name',
			(model: FeaturedModel) => {
				const [namespace, repoName] = model.repoId.split("/");
				expect(namespace.length).toBeGreaterThan(0);
				expect(repoName.length).toBeGreaterThan(0);
			},
		);
	});

	describe("downloadUrl validation", () => {
		it.each(FEATURED_MODELS)(
			"$displayName downloadUrl starts with https://huggingface.co/",
			(model: FeaturedModel) => {
				expect(model.downloadUrl).toMatch(
					/^https:\/\/huggingface\.co\//,
				);
			},
		);
	});

	describe("fileSizeBytes validation", () => {
		it.each(FEATURED_MODELS)(
			"$displayName fileSizeBytes ($fileSizeBytes) is greater than 0",
			(model: FeaturedModel) => {
				expect(model.fileSizeBytes).toBeGreaterThan(0);
			},
		);
	});

	describe("parametersB validation", () => {
		it.each(FEATURED_MODELS)(
			"$displayName parametersB ($parametersB) is between 0 and 12 inclusive",
			(model: FeaturedModel) => {
				expect(model.parametersB).toBeGreaterThanOrEqual(0);
				expect(model.parametersB).toBeLessThanOrEqual(12);
			},
		);
	});

	describe("pipelineTag validation", () => {
		const validPipelineTags = ["text-generation", "image-text-to-text"];

		it.each(FEATURED_MODELS)(
			'$displayName pipelineTag "$pipelineTag" is a valid value',
			(model: FeaturedModel) => {
				expect(validPipelineTags).toContain(model.pipelineTag);
			},
		);
	});

	describe("displayName and description are non-empty", () => {
		it.each(FEATURED_MODELS)(
			"$displayName has non-empty displayName",
			(model: FeaturedModel) => {
				expect(model.displayName.trim().length).toBeGreaterThan(0);
			},
		);

		it.each(FEATURED_MODELS)(
			"$displayName has non-empty description",
			(model: FeaturedModel) => {
				expect(model.description.trim().length).toBeGreaterThan(0);
			},
		);
	});

	describe("sha256 validation", () => {
		it.each(FEATURED_MODELS)(
			"$displayName has sha256 field of type string",
			(model: FeaturedModel) => {
				expect(typeof model.sha256).toBe("string");
			},
		);
	});

	describe("uniqueness", () => {
		it("has no duplicate repoId+filename combinations", () => {
			const keys = FEATURED_MODELS.map(
				(model) => `${model.repoId}::${model.filename}`,
			);
			const uniqueKeys = new Set(keys);
			expect(uniqueKeys.size).toBe(keys.length);
		});
	});
});
