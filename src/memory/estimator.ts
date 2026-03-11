/**
 * Estimates RAM requirements for loading a model.
 *
 * Formula:
 *   totalRAM = modelWeights + kvCache + computeBuffers
 *   modelWeights ≈ fileSizeGB (GGUF file is mmap'd, eventually all resident)
 *   kvCache ≈ (contextSize / 2048) * 100MB
 *   computeBuffers ≈ 50MB
 *
 * @param fileSizeGB - GGUF file size in GB
 * @param contextSize - n_ctx (context window tokens)
 * @returns Estimated RAM in bytes
 */
export function estimateModelRAM(fileSizeGB: number, contextSize: number): number {
	const GB = 1024 * 1024 * 1024;
	const MB = 1024 * 1024;

	const weightsBytes = fileSizeGB * GB;
	const kvCacheBytes = (contextSize / 2048) * 100 * MB;
	const bufferBytes = 50 * MB;

	return weightsBytes + kvCacheBytes + bufferBytes;
}
