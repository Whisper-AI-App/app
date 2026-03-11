import { initWhisper as rnInitWhisper, type WhisperContext } from "whisper.rn";

// Store context instances by id for lookup
const contexts = new Map<number, WhisperContext>();

/**
 * Initialize whisper.rn with a model file.
 * The model should be a GGML whisper model (e.g. ggml-base.bin).
 * Returns the contextId needed for subsequent calls.
 */
export async function initWhisper(modelPath: string): Promise<number> {
	const ctx = await rnInitWhisper({
		filePath: modelPath,
		isBundleAsset: false,
		useFlashAttn: false,
		useGpu: true,
	});

	contexts.set(ctx.id, ctx);
	return ctx.id;
}

/**
 * Transcribe an audio file to text using the loaded whisper model.
 * @param contextId - The context handle from initWhisper()
 * @param jobId - Unique job identifier for this transcription
 * @param audioUri - Path to the audio file (WAV preferred)
 * @returns Transcribed text string
 */
export async function transcribe(contextId: number, _jobId: number, audioUri: string): Promise<string> {
	const ctx = contexts.get(contextId);
	if (!ctx) {
		throw new Error(`Whisper context ${contextId} not found`);
	}

	console.log("[whisper-stt] Transcribing:", audioUri);

	const { promise } = ctx.transcribe(audioUri, {
		language: "auto",
		translate: false,
		maxThreads: 4,
		temperature: 0.4,
	});

	const result = await promise;

	if (result.isAborted) {
		console.warn("[whisper-stt] Transcription was aborted");
		return "";
	}

	const text = result.result.trim();
	console.log("[whisper-stt] Transcription result:", text ? `"${text}"` : "(empty)");
	return text;
}

/**
 * Release the whisper context and free memory (~150MB).
 * @param contextId - The context handle from initWhisper()
 */
export async function release(contextId: number): Promise<void> {
	const ctx = contexts.get(contextId);
	if (!ctx) return;
	try {
		await ctx.release();
	} catch {
		// Ignore errors on release
	}
	contexts.delete(contextId);
}
