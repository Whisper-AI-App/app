import { createLogger } from "@/src/logger";
import * as Device from "expo-device";
import * as FileSystem from "expo-file-system";
import {
	addNativeLogListener,
	initLlama,
	type LlamaContext,
	releaseAllLlama,
	toggleNativeLog,
} from "llama.rn";
import type { Store } from "tinybase";

const logger = createLogger("HuggingFace");

import { deleteProviderCredentials } from "../../actions/secure-credentials";
import {
	checkBudget,
	getDeviceMemoryTier,
	getDeviceTierStrategy,
} from "../../memory/budget";
import {
	dispatch,
	getCapabilityStatus,
	resetState,
	subscribe,
} from "../../memory/state";
import { initSTT } from "../../stt";
import { bytesToGB } from "../../utils/bytes";
import {
	setReleaseMultimodalFn,
	startMemoryPressureMonitor,
} from "../../utils/memory-pressure";
import { getAvailableMemory } from "../../utils/native-memory";
import type {
	AIProvider,
	CompletionMessage,
	CompletionMessagePart,
	CompletionResult,
	MultimodalCapabilities,
	ProviderModel,
} from "../types";
import { DEFAULT_CONSTRAINTS, NO_MULTIMODAL } from "../types";
import { searchModels } from "./api";
import {
	pauseDownload as pauseHFDownload,
	resumeDownload as resumeHFDownload,
	startDownload as startHFDownload,
} from "./download";

const PROVIDER_ID = "huggingface";
const DEFAULT_CONTEXT_SIZE = 2048;

const DEFAULT_SAMPLING = {
	temperature: 0.7,
	top_p: 0.9,
	top_k: 40,
	min_p: 0.05,
} as const;

// Module-scoped runtime state
let llamaContext: LlamaContext | null = null;
let currentContextSize = DEFAULT_CONTEXT_SIZE;
let setupPromise: Promise<void> | null = null;
let resolvedMultimodalCaps: MultimodalCapabilities = NO_MULTIMODAL;
let storedMmprojUri: string | null = null;
let storedIsVisionModel = false;
let stateUnsubscribe: (() => void) | null = null;

function getModelFileUri(store: Store): string | undefined {
	const filename = store.getCell("aiProviders", PROVIDER_ID, "filename") as
		| string
		| undefined;
	if (filename) {
		return `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${filename}`;
	}
	return undefined;
}

/**
 * Convert multimodal message parts to llama.rn format.
 * Vision-capable: images become { type: 'image_url', image_url: { url } }
 * Unsupported types: replaced with alt-text
 */
function convertToLlamaMessages(
	messages: CompletionMessage[],
	hasVision: boolean,
): CompletionMessage[] {
	return messages.map((msg) => {
		if (typeof msg.content === "string") return msg;

		const parts = msg.content as CompletionMessagePart[];
		const llamaParts: unknown[] = [];

		for (const part of parts) {
			if (part.type === "text") {
				llamaParts.push({ type: "text", text: part.text });
			} else if (part.type === "image" && hasVision) {
				llamaParts.push({
					type: "image_url",
					image_url: { url: part.uri },
				});
			} else {
				// Unsupported type — fallback to alt text
				const alt =
					part.type === "image"
						? part.alt
						: part.type === "audio"
							? part.alt
							: part.type === "file"
								? part.alt
								: "";
				if (alt) {
					llamaParts.push({ type: "text", text: `[${alt}]` });
				}
			}
		}

		return { ...msg, content: llamaParts as CompletionMessagePart[] };
	});
}

/**
 * Get the current capability initialization status.
 * Reads from the state machine instead of legacy ad-hoc variables.
 */
export function getCapabilityInitStatus() {
	const visionStatus = getCapabilityStatus("vision");
	const sttStatus = getCapabilityStatus("stt");

	const vision =
		visionStatus === "ready"
			? ("ready" as const)
			: visionStatus === "loading"
				? ("loading" as const)
				: ("unavailable" as const);
	const audio =
		sttStatus === "ready"
			? ("ready" as const)
			: sttStatus === "loading"
				? ("loading" as const)
				: ("unavailable" as const);

	return { vision, audio };
}

/**
 * On-demand vision loading with budget check.
 * Called when user attaches an image for the first time.
 * Returns true if vision is now available, false if denied.
 */
async function loadVisionOnDemand(
	updateCapabilities: (caps: MultimodalCapabilities) => void,
): Promise<boolean> {
	const visionStatus = getCapabilityStatus("vision");

	// Already loaded
	if (visionStatus === "ready") return true;
	// Already loading
	if (visionStatus === "loading") return false;

	if (!llamaContext || !storedMmprojUri) {
		logger.warn("Cannot load vision: no context or mmproj URI");
		return false;
	}

	// Transition to loading
	dispatch(
		"vision",
		visionStatus === "budget_denied"
			? { type: "RETRY" }
			: { type: "USER_REQUEST" },
	);

	// Budget check — mmproj has no context window
	const mmprojFile = new FileSystem.File(storedMmprojUri);
	if (!mmprojFile.exists) {
		dispatch("vision", {
			type: "LOAD_FAIL_ERROR",
			error: "mmproj file not found",
		});
		return false;
	}
	const mmprojSizeGB = mmprojFile.size ? bytesToGB(mmprojFile.size) : 0.67;
	const budget = await checkBudget(mmprojSizeGB, 0);

	if (!budget.canLoad) {
		dispatch("vision", { type: "LOAD_FAIL_BUDGET" });
		logger.warn("Vision budget denied", {
			availableGB: (budget.availableBytes / (1024 * 1024 * 1024)).toFixed(1),
			neededGB: (budget.estimatedModelBytes / (1024 * 1024 * 1024)).toFixed(1),
			source: budget.source,
		});
		return false;
	}

	// Load mmproj
	// use_gpu: false works around a known llama.cpp issue where the auto-fit
	// memory estimation does not account for mmproj GPU memory, causing GPU OOM
	// / GPU hang crashes on iOS (llama.rn#176, llama.cpp#19980).
	try {
		await llamaContext.initMultimodal({
			path: storedMmprojUri,
			use_gpu: false,
		});
		const support = await llamaContext?.getMultimodalSupport?.();
		if (support?.vision) {
			dispatch("vision", { type: "LOAD_SUCCESS" });
			updateCapabilities({
				...resolvedMultimodalCaps,
				vision: true,
			});
			logger.info("Vision capability unlocked (on-demand)");
			return true;
		}
		dispatch("vision", {
			type: "LOAD_FAIL_ERROR",
			error: "vision not reported after init",
		});
		logger.warn("initMultimodal completed but vision not available");
		return false;
	} catch (err) {
		dispatch("vision", { type: "LOAD_FAIL_ERROR", error: String(err) });
		logger.warn("Failed to init multimodal", {
			error: err instanceof Error ? err.message : String(err),
		});
		return false;
	}
}

export function createHuggingFaceProvider(store: Store): AIProvider {
	let capabilitiesVersion = 0;

	/**
	 * Update multimodal capabilities and notify React subscribers.
	 * Bumps a TinyBase cell so components using useCell() re-render
	 * and pick up the new capabilities via getMultimodalCapabilities().
	 */
	function updateCapabilities(newCaps: MultimodalCapabilities) {
		resolvedMultimodalCaps = newCaps;
		store.setCell(
			"aiProviders",
			PROVIDER_ID,
			"capabilitiesVersion",
			++capabilitiesVersion,
		);
	}

	const provider: AIProvider = {
		id: PROVIDER_ID,
		name: "Hugging Face",
		description: "Browse and run thousands of open-source AI models on-device.",
		avatar: require("../../../assets/images/ai-providers/huggingface.png"),
		type: "local",
		capabilities: {
			oauth: false,
			download: true,
			modelBrowsing: true,
			userApiKey: false,
		},

		enable() {
			store.setRow("aiProviders", PROVIDER_ID, {
				id: PROVIDER_ID,
				status: "needs_setup",
				error: "",
				selectedModelId: "",
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
			});
		},

		async disable() {
			// Release llama context
			try {
				await releaseAllLlama();
			} catch (error) {
				logger.error("Error releasing context on disable", {
					error: error instanceof Error ? error.message : String(error),
				});
			}
			llamaContext = null;
			currentContextSize = DEFAULT_CONTEXT_SIZE;
			resolvedMultimodalCaps = NO_MULTIMODAL;
			storedMmprojUri = null;
			storedIsVisionModel = false;
			resetState();
			stateUnsubscribe?.();
			stateUnsubscribe = null;
			setReleaseMultimodalFn(null);
			capabilitiesVersion = 0;

			// Delete all downloaded model and mmproj files
			const modelRowIds = store.getRowIds("hfModels");
			for (const rowId of modelRowIds) {
				const localFilename = store.getCell(
					"hfModels",
					rowId,
					"localFilename",
				) as string | undefined;
				if (localFilename) {
					try {
						const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${localFilename}`;
						const file = new FileSystem.File(fileUri);
						if (file.exists) {
							file.delete();
						}
					} catch (error) {
						logger.error("Error deleting model file", {
							filename: localFilename,
							error: error instanceof Error ? error.message : String(error),
						});
					}
				}
				const mmprojLocalFilename = store.getCell(
					"hfModels",
					rowId,
					"mmprojLocalFilename",
				) as string | undefined;
				if (mmprojLocalFilename) {
					try {
						const mmprojUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${mmprojLocalFilename}`;
						const mmprojFile = new FileSystem.File(mmprojUri);
						if (mmprojFile.exists) {
							mmprojFile.delete();
						}
					} catch (error) {
						logger.error("Error deleting mmproj file", {
							filename: mmprojLocalFilename,
							error: error instanceof Error ? error.message : String(error),
						});
					}
				}
				store.delRow("hfModels", rowId);
			}

			// Delete stored HF token
			await deleteProviderCredentials(PROVIDER_ID);

			store.delRow("aiProviders", PROVIDER_ID);
		},

		async setup() {
			// Sync capabilitiesVersion from store
			const storedCapabilitiesVersion = store.getCell(
				"aiProviders",
				PROVIDER_ID,
				"capabilitiesVersion",
			) as number | undefined;
			if (typeof storedCapabilitiesVersion === "number") {
				capabilitiesVersion = storedCapabilitiesVersion;
			}

			// Already loaded - just sync store status
			if (llamaContext) {
				store.setCell("aiProviders", PROVIDER_ID, "status", "ready");
				return;
			}

			// Prevent concurrent setup
			if (setupPromise) {
				return setupPromise;
			}

			const run = async () => {
				const selectedModelId = store.getCell(
					"aiProviders",
					PROVIDER_ID,
					"selectedModelId",
				) as string | undefined;

				if (!selectedModelId) {
					store.setCell("aiProviders", PROVIDER_ID, "status", "needs_setup");
					return;
				}

				// Check hfModels row exists and is downloaded
				const modelRow = store.getRow("hfModels", selectedModelId);
				if (!modelRow?.downloadedAt) {
					store.setCell("aiProviders", PROVIDER_ID, "status", "needs_setup");
					return;
				}

				const localFilename = modelRow.localFilename as string;
				const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${localFilename}`;

				// Check if file exists and is not corrupted/truncated
				const file = new FileSystem.File(fileUri);
				if (!file.exists) {
					logger.warn("GGUF file missing, marking as needs_setup");
					store.setCell("aiProviders", PROVIDER_ID, "fileRemoved", true);
					store.setCell("aiProviders", PROVIDER_ID, "status", "needs_setup");
					return;
				}

				// File size sanity check — detect truncated/corrupted downloads
				const expectedSize = modelRow.fileSizeBytes as number | undefined;
				if (expectedSize && file.size && file.size < expectedSize * 0.95) {
					logger.warn("File appears truncated", {
						actualBytes: file.size,
						expectedBytes: expectedSize,
					});
					store.setCell("aiProviders", PROVIDER_ID, "fileRemoved", true);
					store.setCell("aiProviders", PROVIDER_ID, "status", "needs_setup");
					store.setCell(
						"aiProviders",
						PROVIDER_ID,
						"error",
						"Model file appears corrupted. Please re-download.",
					);
					return;
				}

				logger.info("Configuring model");
				store.setCell("aiProviders", PROVIDER_ID, "status", "configuring");

				try {
					await releaseAllLlama();
					await new Promise((resolve) => setTimeout(resolve, 200));
					const postReleaseMemory = await getAvailableMemory();
					logger.info("releaseAllLlama completed, 200ms settle done", {
						availableMemoryMB: (
							postReleaseMemory.bytes /
							(1024 * 1024)
						).toFixed(1),
						source: postReleaseMemory.source,
					});
				} catch (error) {
					logger.error("Trouble releasing existing context", {
						error: error instanceof Error ? error.message : String(error),
					});
				}

				try {
					const isAndroid = process.env.EXPO_OS === "android";
					const deviceMemoryBytes = Device.totalMemory;
					const ramGB = deviceMemoryBytes ? bytesToGB(deviceMemoryBytes) : 4;

					// Budget check
					const modelSizeGB = file.size ? bytesToGB(file.size) : 1.0;

					// RAM-linear context scaling
					const storedContextLength = modelRow.contextLength as
						| number
						| undefined;
					const modelContextLength =
						storedContextLength && storedContextLength > 0
							? storedContextLength
							: DEFAULT_CONTEXT_SIZE;
					const ramScaledCtx = Math.max(
						512,
						Math.round((ramGB * 1024) / modelSizeGB),
					);
					const nCtx = Math.min(modelContextLength, ramScaledCtx);

					const chatBudget = await checkBudget(modelSizeGB, nCtx);

					if (!chatBudget.canLoad) {
						const availGB = (
							chatBudget.availableBytes /
							(1024 * 1024 * 1024)
						).toFixed(1);
						const needGB = (
							(chatBudget.estimatedModelBytes * 1.3) /
							(1024 * 1024 * 1024)
						).toFixed(1);
						const errorMsg = `Not enough memory to load model. Available: ${availGB}GB, Required: ${needGB}GB. Close other apps and try again.`;
						store.setCell("aiProviders", PROVIDER_ID, "error", errorMsg);
						store.setCell("aiProviders", PROVIDER_ID, "status", "error");
						throw new Error(errorMsg);
					}

					// GPU layers based on device tier
					const deviceTier = getDeviceMemoryTier(ramGB);
					let gpuLayers: number;
					if (isAndroid) {
						gpuLayers = 0;
					} else {
						switch (deviceTier) {
							case "minimal":
							case "conservative":
								gpuLayers = 0;
								break;
							case "balanced":
								gpuLayers = 32;
								break;
							default:
								gpuLayers = 99;
								break;
						}
					}

					const useMlock =
						!isAndroid &&
						(deviceTier === "full" || deviceTier === "unrestricted");

					// Multimodal (vision) models require ctx_shift: false because
					// context shifting is incompatible with how multimodal embeddings
					// are positioned in the KV cache — shifting corrupts the image
					// token positions, causing native crashes / segfaults in llama.cpp.
					const pipelineTag = modelRow.pipelineTag as string | undefined;
					const isVisionModel = pipelineTag === "image-text-to-text";
					const ctxShift = isVisionModel ? false : undefined;

					logger.info("Loading model", {
						n_ctx: nCtx,
						gpu_layers: gpuLayers,
						tier: deviceTier,
						isVisionModel,
					});

					// Enable native llama.cpp logging to capture crash details
					await toggleNativeLog(true);
					addNativeLogListener((level, text) => {
						if (level === "warn" || level === "error") {
							logger.warn("llama.cpp", { level, text: text.trimEnd() });
						}
					});

					try {
						llamaContext = await initLlama({
							model: fileUri,
							use_mlock: useMlock,
							n_ctx: nCtx,
							n_gpu_layers: gpuLayers,
							cache_type_k: "f16",
							cache_type_v: "f16",
							...(ctxShift !== undefined && { ctx_shift: ctxShift }),
						});
					} catch (loadError) {
						if (gpuLayers > 0) {
							logger.warn("Load failed, retrying CPU-only", {
								error:
									loadError instanceof Error
										? loadError.message
										: String(loadError),
							});
							llamaContext = await initLlama({
								model: fileUri,
								use_mlock: false,
								n_ctx: nCtx,
								n_gpu_layers: 0,
								cache_type_k: "f16",
								cache_type_v: "f16",
								...(ctxShift !== undefined && { ctx_shift: ctxShift }),
							});
						} else {
							throw loadError;
						}
					}

					currentContextSize = nCtx;

					// Store vision config for on-demand loading
					storedIsVisionModel = isVisionModel;
					storedMmprojUri = null;
					if (isVisionModel) {
						const mmprojDownloadedAt = modelRow.mmprojDownloadedAt as
							| string
							| undefined;
						const mmprojLocalFilename = modelRow.mmprojLocalFilename as
							| string
							| undefined;
						if (mmprojDownloadedAt && mmprojLocalFilename) {
							storedMmprojUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${mmprojLocalFilename}`;
						}
					}

					// Reset state machine for fresh setup
					resetState();

					// Set initial capabilities — audio always true, vision deferred to on-demand loading
					updateCapabilities({
						vision: false,
						audio: true,
						files: false,
						constraints: DEFAULT_CONSTRAINTS,
					});

					store.setCell("aiProviders", PROVIDER_ID, "status", "ready");
					store.setCell("aiProviders", PROVIDER_ID, "error", "");
					logger.info("Model loaded — ready");

					// Subscribe to state machine changes to update capabilities reactively
					stateUnsubscribe?.();
					stateUnsubscribe = subscribe((capability, newStatus) => {
						if (capability === "vision") {
							updateCapabilities({
								...resolvedMultimodalCaps,
								vision: newStatus === "ready",
							});
						}
					});

					// Set up memory pressure release function for centralized handler
					if (llamaContext) {
						const ctx = llamaContext;
						setReleaseMultimodalFn(async () => {
							try {
								await ctx.releaseMultimodal?.();
							} catch (e) {
								logger.error("releaseMultimodal error", {
									error: e instanceof Error ? e.message : String(e),
								});
							}
						});
					}

					// Start centralized memory pressure monitor
					startMemoryPressureMonitor();

					// Tier-based background pre-warming (sequential to avoid OOM)
					const tierStrategy = getDeviceTierStrategy();

					(async () => {
						// 1. Pre-warm vision first (if tier allows and mmproj is available)
						if (
							tierStrategy.preWarmVision &&
							storedIsVisionModel &&
							storedMmprojUri &&
							llamaContext
						) {
							logger.info("Pre-warming vision");
							try {
								await loadVisionOnDemand(updateCapabilities);
							} catch (err) {
								logger.warn("Vision pre-warm failed", {
									error: err instanceof Error ? err.message : String(err),
								});
							}

							// Small delay to let memory settle before next allocation
							await new Promise((resolve) => setTimeout(resolve, 500));
						}

						// 2. Then pre-warm STT (if tier allows)
						if (tierStrategy.preWarmSTT) {
							logger.info("Pre-warming STT");
							dispatch("stt", { type: "PRE_WARM" });
							try {
								await initSTT();
								dispatch("stt", { type: "LOAD_SUCCESS" });
								logger.info("STT pre-warmed successfully");
							} catch (err: unknown) {
								dispatch("stt", {
									type: "LOAD_FAIL_ERROR",
									error: String(err),
								});
								logger.warn("STT pre-warm failed", {
									error: err instanceof Error ? err.message : String(err),
								});
							}
						}
					})().catch((err) => {
						logger.warn("Sequential pre-warm IIFE failed unexpectedly", {
							error: err instanceof Error ? err.message : String(err),
						});
					});
				} catch (error) {
					logger.error("Failed to load model", {
						error: error instanceof Error ? error.message : String(error),
					});
					const errorMessage =
						error instanceof Error ? error.message : "Failed to load model";
					store.setCell("aiProviders", PROVIDER_ID, "error", errorMessage);
					store.setCell("aiProviders", PROVIDER_ID, "status", "error");
					throw error;
				}
			};

			setupPromise = run();
			try {
				await setupPromise;
			} finally {
				setupPromise = null;
			}
		},

		async models(search?: string) {
			if (search) {
				// Search HF Hub API
				const results = await searchModels(search);
				return results.map((r) => ({
					id: r.repoId,
					name: r.repoId.split("/").pop() ?? r.repoId,
					description: `${r.downloads.toLocaleString()} downloads`,
				}));
			}

			// Return downloaded models
			const modelRowIds = store.getRowIds("hfModels");
			const models: ProviderModel[] = modelRowIds.map((rowId) => {
				const row = store.getRow("hfModels", rowId);
				return {
					id: rowId,
					name: (row?.displayName as string) || rowId,
					description: `${((row?.fileSizeBytes as number) / (1024 * 1024 * 1024)).toFixed(1)} GB, ${row?.quantization}`,
				};
			});
			return models;
		},

		setModel(modelId: string) {
			store.setCell("aiProviders", PROVIDER_ID, "selectedModelId", modelId);
			const row = store.getRow("hfModels", modelId);
			if (row?.localFilename) {
				store.setCell(
					"aiProviders",
					PROVIDER_ID,
					"filename",
					row.localFilename as string,
				);
			}
			updateCapabilities({ ...resolvedMultimodalCaps });
		},

		async startDownload(restart?: boolean) {
			return await startHFDownload(store, restart);
		},

		pauseDownload() {
			pauseHFDownload(store);
		},

		async resumeDownload() {
			await resumeHFDownload(store);
		},

		async completion(
			messages: CompletionMessage[],
			onToken: (token: string) => void,
		): Promise<CompletionResult> {
			if (!llamaContext) {
				return {
					content: "",
					finishReason: "error",
				};
			}

			const convertedMessages = convertToLlamaMessages(
				messages,
				resolvedMultimodalCaps.vision,
			);

			const result = await llamaContext.completion(
				{
					messages: convertedMessages,
					n_predict: -1,
					stop: [],
					...DEFAULT_SAMPLING,
					enable_thinking: false,
				},
				(data) => {
					onToken(data.token);
				},
			);

			let finishReason: CompletionResult["finishReason"];
			if (result.stopped_eos) {
				finishReason = "stop";
			} else if (result.context_full) {
				finishReason = "length";
			} else {
				// catch-all for stopped_limit and other stop reasons
				finishReason = "length";
			}

			return {
				content: result.content,
				finishReason,
				usage: {
					promptTokens: result.tokens_evaluated,
					completionTokens: result.tokens_predicted,
				},
			};
		},

		stopCompletion() {
			if (llamaContext) {
				llamaContext.stopCompletion();
			}
		},

		isConfigured(): boolean {
			return llamaContext !== null;
		},

		getSystemMessage(_conversationMessages: CompletionMessage[]): string {
			return `You are a helpful, private AI assistant running on-device via Hugging Face. All conversations stay on the device. Be useful, creative, and accurate. Today's date is ${new Date().toLocaleString()}.`;
		},

		getContextSize(): number {
			return currentContextSize;
		},

		getMultimodalCapabilities(): MultimodalCapabilities {
			return resolvedMultimodalCaps;
		},

		async clearCache() {
			if (!llamaContext) return;
			const model = llamaContext.model as {
				is_hybrid?: boolean;
				is_recurrent?: boolean;
			};
			if (model.is_hybrid || model.is_recurrent) {
				await llamaContext.clearCache(false);
			}
		},

		async teardown() {
			// Dispatch teardown events to state machine
			if (getCapabilityStatus("vision") === "ready") {
				dispatch("vision", { type: "TEARDOWN" });
			}
			if (getCapabilityStatus("stt") === "ready") {
				dispatch("stt", { type: "TEARDOWN" });
			}

			try {
				await releaseAllLlama();
			} catch (error) {
				logger.error("Error releasing context", {
					error: error instanceof Error ? error.message : String(error),
				});
			}

			// Complete release transitions
			if (getCapabilityStatus("vision") === "releasing") {
				dispatch("vision", { type: "RELEASE_COMPLETE" });
			}
			if (getCapabilityStatus("stt") === "releasing") {
				dispatch("stt", { type: "RELEASE_COMPLETE" });
			}

			llamaContext = null;
			currentContextSize = DEFAULT_CONTEXT_SIZE;
			resolvedMultimodalCaps = NO_MULTIMODAL;
			storedMmprojUri = null;
			storedIsVisionModel = false;
			stateUnsubscribe?.();
			stateUnsubscribe = null;
			setReleaseMultimodalFn(null);
			resetState();
		},

		async deleteModel(modelId: string) {
			const row = store.getRow("hfModels", modelId);
			if (!row) return;

			// Delete model file from filesystem
			const localFilename = row.localFilename as string;
			if (localFilename) {
				try {
					const fileUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${localFilename}`;
					const file = new FileSystem.File(fileUri);
					if (file.exists) {
						file.delete();
					}
				} catch (error) {
					logger.error("Error deleting model file", {
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			// Delete mmproj file from filesystem
			const mmprojLocalFilename = row.mmprojLocalFilename as string | undefined;
			if (mmprojLocalFilename) {
				try {
					const mmprojUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${mmprojLocalFilename}`;
					const mmprojFile = new FileSystem.File(mmprojUri);
					if (mmprojFile.exists) {
						mmprojFile.delete();
					}
				} catch (error) {
					logger.error("Error deleting mmproj file", {
						error: error instanceof Error ? error.message : String(error),
					});
				}
			}

			// Remove hfModels row
			store.delRow("hfModels", modelId);

			// Handle active model deletion
			const selectedModelId = store.getCell(
				"aiProviders",
				PROVIDER_ID,
				"selectedModelId",
			) as string;
			if (selectedModelId === modelId) {
				// Release context if loaded
				if (llamaContext) {
					try {
						await releaseAllLlama();
					} catch (error) {
						logger.error(
							"Error releasing context after active model deletion",
							{ error: error instanceof Error ? error.message : String(error) },
						);
					}
					llamaContext = null;
					currentContextSize = DEFAULT_CONTEXT_SIZE;
				}

				store.setCell("aiProviders", PROVIDER_ID, "selectedModelId", "");
				store.setCell("aiProviders", PROVIDER_ID, "filename", "");
				store.setCell("aiProviders", PROVIDER_ID, "status", "needs_setup");
			}
		},
	};

	return provider;
}

/**
 * Trigger on-demand vision loading from external code (e.g., chat.tsx).
 * Returns true if vision is now available.
 */
export { loadVisionOnDemand };
