/**
 * Extracts a safe model name from a URL.
 * Example: "https://huggingface.co/.../Qwen3-4B-Q4_0.gguf" => "Qwen3-4B-Q4_0"
 */
export function extractLLMModelNameFromUrl(url: string): string {
	try {
		const urlParts = url.split("/");
		const filename = urlParts[urlParts.length - 1];
		// Remove .gguf extension and sanitize
		const modelName = filename.replace(/\.gguf$/i, "");
		// Replace any non-alphanumeric characters (except hyphens and underscores) with underscores
		return modelName.replace(/[^a-zA-Z0-9_-]/g, "_");
	} catch (error) {
		console.error("extractLLMModelNameFromUrl() error", error);

		// Fallback to timestamp-based name
		return `model_${Date.now().toString().replace(/\./gi, "_")}`;
	}
}
