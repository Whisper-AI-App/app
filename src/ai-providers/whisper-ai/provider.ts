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
import type {
	ResolvedRuntime,
	RuntimeConfig,
	WhisperLLMCard,
} from "whisper-llm-cards";
import {
	processSystemMessage,
	resolveMultimodalConfig,
	resolveRuntimeConfig,
} from "whisper-llm-cards";
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
	MultimodalConstraints,
	ProviderModel,
} from "../types";
import { DEFAULT_CONSTRAINTS, NO_MULTIMODAL } from "../types";
import { pauseDownload, resumeDownload, startDownload } from "./download";
import {
	fetchLatestRecommendedModel,
	getStoredModelCard,
} from "./model-config";

const DEFAULT_CONTEXT_SIZE = 2048;

// Module-scoped runtime state
let llamaContext: LlamaContext | null = null;
let runtimeConfig: ResolvedRuntime | undefined;
let stopWords: string[] = [];
let currentContextSize = DEFAULT_CONTEXT_SIZE;
let setupPromise: Promise<void> | null = null;
let resolvedMultimodalCaps: MultimodalCapabilities = NO_MULTIMODAL;
// Stored model card constraints for on-demand vision loading
let _storedConstraints: MultimodalConstraints = { ...DEFAULT_CONSTRAINTS };
let storedCardWantsVision = false;
let storedMmprojUri: string | null = null;
let storedImageMinTokens: number | undefined;
let storedImageMaxTokens: number | undefined;
let stateUnsubscribe: (() => void) | null = null;

/**
 * Get the current capability initialization status.
 * Reads from the state machine instead of legacy ad-hoc variables.
 */
export function getCapabilityInitStatus() {
	const visionStatus = getCapabilityStatus("vision");
	const sttStatus = getCapabilityStatus("stt");

	// Map state machine statuses to the legacy API format for backward compatibility
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

		// Convert CompletionMessagePart[] to llama.rn compatible format
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

function getModelFileUri(store: Store): string | undefined {
	const filename = store.getCell("aiProviders", "whisper-ai", "filename") as
		| string
		| undefined;
	if (filename) {
		return `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${filename}`;
	}
	return undefined;
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
		console.warn("[WhisperAI] Cannot load vision: no context or mmproj URI");
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
		console.warn(
			`[WhisperAI] Vision budget denied: ${(budget.availableBytes / (1024 * 1024 * 1024)).toFixed(1)}GB avail, ` +
				`${(budget.estimatedModelBytes / (1024 * 1024 * 1024)).toFixed(1)}GB needed (${budget.source})`,
		);
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
			image_min_tokens: storedImageMinTokens,
			image_max_tokens: storedImageMaxTokens,
		});
		const support = await llamaContext?.getMultimodalSupport?.();
		if (support?.vision) {
			dispatch("vision", { type: "LOAD_SUCCESS" });
			updateCapabilities({
				...resolvedMultimodalCaps,
				vision: true,
			});
			console.info("[WhisperAI] Vision capability unlocked (on-demand)");
			return true;
		}
		dispatch("vision", {
			type: "LOAD_FAIL_ERROR",
			error: "vision not reported after init",
		});
		console.warn(
			"[WhisperAI] initMultimodal completed but vision not available",
		);
		return false;
	} catch (err) {
		dispatch("vision", { type: "LOAD_FAIL_ERROR", error: String(err) });
		console.warn("[WhisperAI] Failed to init multimodal:", err);
		return false;
	}
}

export function createWhisperAIProvider(store: Store): AIProvider {
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
			"whisper-ai",
			"capabilitiesVersion",
			++capabilitiesVersion,
		);
	}

	const provider: AIProvider = {
		id: "whisper-ai",
		name: "Whisper AI",
		description: "100% private, on-device AI. No internet needed.",
		avatar: require("../../../assets/images/icon.png"),
		type: "local",
		capabilities: {
			oauth: false,
			download: true,
			userApiKey: false,
		},

		enable() {
			store.setRow("aiProviders", "whisper-ai", {
				id: "whisper-ai",
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
			});
		},

		async disable() {
			// Release llama context
			try {
				await releaseAllLlama();
			} catch (error) {
				console.error("[WhisperAI] Error releasing context on disable", error);
			}
			llamaContext = null;
			runtimeConfig = undefined;
			stopWords = [];
			currentContextSize = DEFAULT_CONTEXT_SIZE;
			resolvedMultimodalCaps = NO_MULTIMODAL;
			storedCardWantsVision = false;
			storedMmprojUri = null;
			storedImageMinTokens = undefined;
			storedImageMaxTokens = undefined;
			_storedConstraints = { ...DEFAULT_CONSTRAINTS };
			resetState();
			stateUnsubscribe?.();
			stateUnsubscribe = null;
			setReleaseMultimodalFn(null);
			capabilitiesVersion = 0;

			// Delete the model file
			const fileUri = getModelFileUri(store);
			if (fileUri) {
				try {
					const file = new FileSystem.File(fileUri);
					if (file.exists) {
						file.delete();
					}
				} catch (error) {
					console.error("[WhisperAI] Error deleting model file", error);
				}
			}

			store.delRow("aiProviders", "whisper-ai");
		},

		async setup() {
			// Already loaded - just sync store status
			if (llamaContext) {
				store.setCell("aiProviders", "whisper-ai", "status", "ready");
				return;
			}

			// Prevent concurrent setup - return existing promise if in progress
			if (setupPromise) {
				return setupPromise;
			}

			const run = async () => {
				const fileUri = getModelFileUri(store);
				const downloadedAt = store.getCell(
					"aiProviders",
					"whisper-ai",
					"downloadedAt",
				) as string | undefined;

				if (!fileUri || !downloadedAt) {
					store.setCell("aiProviders", "whisper-ai", "status", "needs_setup");
					return;
				}

				// Check if file exists
				const file = new FileSystem.File(fileUri);
				if (!file.exists) {
					console.warn(
						"[WhisperAI] GGUF file missing, marking as needs_setup",
						fileUri,
					);
					store.setCell("aiProviders", "whisper-ai", "filename", "");
					store.setCell("aiProviders", "whisper-ai", "downloadedAt", "");
					store.setCell("aiProviders", "whisper-ai", "fileRemoved", true);
					store.setCell("aiProviders", "whisper-ai", "status", "needs_setup");
					return;
				}

				console.info("[WhisperAI:Setup] Configuring model");
				store.setCell("aiProviders", "whisper-ai", "status", "configuring");

				try {
					await releaseAllLlama();
					// Allow native mmap unmap to complete before re-allocating
					await new Promise((resolve) => setTimeout(resolve, 200));
					const postReleaseMemory = await getAvailableMemory();
					console.info(
						`[WhisperAI:Setup] releaseAllLlama completed, 200ms settle done. Available memory: ${(postReleaseMemory.bytes / (1024 * 1024)).toFixed(1)}MB (source=${postReleaseMemory.source})`,
					);
				} catch (error) {
					console.error(
						"[WhisperAI] Trouble releasing existing context",
						error,
					);
				}

				try {
					// Parse model card and resolve runtime expressions
					const cardJson = store.getCell(
						"aiProviders",
						"whisper-ai",
						"modelCard",
					) as string | undefined;
					let rawRuntime: RuntimeConfig | undefined;
					let cardHasMultimodal = false;
					if (cardJson) {
						try {
							const card = JSON.parse(cardJson);
							rawRuntime = card.runtime;
							cardHasMultimodal = !!card.multimodal?.mmproj;
						} catch {
							// ignore
						}
					}

					const isAndroid = process.env.EXPO_OS === "android";
					const deviceMemoryBytes = Device.totalMemory;
					const ramGB = deviceMemoryBytes ? bytesToGB(deviceMemoryBytes) : 4;
					const device = {
						ramGB,
						cpuCoreCount: 4,
						platform: process.env.EXPO_OS ?? "ios",
					};
					const runtime = await resolveRuntimeConfig(rawRuntime, device);
					const contextSize = runtime.n_ctx;

					// T065: Budget check gate before initLlama()
					const modelSizeGB = file.size ? bytesToGB(file.size) : 1.0;
					console.info(
						`[WhisperAI:Setup] Budget check starting: modelSizeGB=${modelSizeGB.toFixed(2)}, contextSize=${contextSize}`,
					);
					const chatBudget = await checkBudget(modelSizeGB, contextSize);
					console.info(
						`[WhisperAI:Setup] Budget check result: estimatedModel=${(chatBudget.estimatedModelBytes / (1024 * 1024)).toFixed(1)}MB, available=${(chatBudget.availableBytes / (1024 * 1024)).toFixed(1)}MB, source=${chatBudget.source}, headroom=1.3x, canLoad=${chatBudget.canLoad}`,
					);
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
						console.warn(
							`[WhisperAI] Chat model budget denied (${chatBudget.source}): ${availGB}GB avail, need ${needGB}GB`,
						);
						store.setCell("aiProviders", "whisper-ai", "error", errorMsg);
						store.setCell("aiProviders", "whisper-ai", "status", "error");
						throw new Error(errorMsg);
					}

					// Multimodal (vision) models require ctx_shift: false because
					// context shifting is incompatible with how multimodal embeddings
					// are positioned in the KV cache — shifting corrupts the image
					// token positions, causing native crashes / segfaults in llama.cpp.
					const ctxShift = cardHasMultimodal ? false : undefined;

					// Cap GPU layers based on device memory tier to prevent OOM kills
					// on low-memory iPhones. GPU shares system RAM on iOS (unified
					// memory), so full offload can exhaust available memory.
					const requestedGpuLayers =
						runtime.n_gpu_layers ?? (isAndroid ? 0 : 99);
					const deviceTier = getDeviceMemoryTier(ramGB);
					let gpuLayers: number;
					if (isAndroid) {
						gpuLayers = requestedGpuLayers;
					} else {
						switch (deviceTier) {
							case "minimal":
							case "conservative":
								gpuLayers = 0; // CPU-only on ≤5GB devices
								break;
							case "balanced":
								gpuLayers = Math.min(requestedGpuLayers, 32);
								break;
							default:
								gpuLayers = requestedGpuLayers;
								break;
						}
					}

					// Disable mlock on low-memory iOS devices. mlock() wires mmap'd
					// model pages into non-evictable physical RAM, which counts against
					// the jetsam limit (~2GB on 4GB iPhones). Without mlock, pages stay
					// "clean/external" and the OS can evict/re-read them on demand.
					const useMlock =
						!isAndroid &&
						(deviceTier === "full" || deviceTier === "unrestricted");

					// DEBUG: Cap context for low-memory tiers to test if crash is memory-related
					// KV cache is proportional to n_ctx, so capping at 512 dramatically
					// reduces memory usage. If the crash disappears, the root cause is
					// memory exhaustion during KV cache allocation, not a native bug.
					let effectiveContextSize = contextSize;
					if (deviceTier === "conservative" || deviceTier === "minimal") {
						const cappedCtx = Math.min(contextSize, 512);
						console.warn(
							`[WhisperAI:DEBUG] Capping n_ctx from ${contextSize} to ${cappedCtx} for tier="${deviceTier}" (memory diagnostic)`,
						);
						effectiveContextSize = cappedCtx;
					}

					// DEBUG: Force f16 KV cache for conservative/minimal tiers.
					// The quantized q4_0 cache may be incompatible with LFM2.5's
					// hybrid recurrent architecture on CPU. If crashes disappear
					// with f16 the root cause is quantized-cache incompatibility.
					let effectiveCacheTypeK = runtime.cache_type_k;
					let effectiveCacheTypeV = runtime.cache_type_v;
					if (deviceTier === "conservative" || deviceTier === "minimal") {
						console.warn(
							`[WhisperAI:DEBUG] Overriding cache_type_k="${runtime.cache_type_k}" → "f16", cache_type_v="${runtime.cache_type_v}" → "f16" for tier="${deviceTier}" (KV cache diagnostic)`,
						);
						effectiveCacheTypeK = "f16";
						effectiveCacheTypeV = "f16";
					}

					// Log actual file size on disk before initLlama
					console.info(
						`[WhisperAI:Setup] Model file size on disk: ${file.size} bytes (${((file.size ?? 0) / (1024 * 1024)).toFixed(1)} MB)`,
					);

					console.info(
						`[WhisperAI:Setup] Loading model (n_ctx=${effectiveContextSize}, gpu_layers=${gpuLayers}, mlock=${useMlock}, tier=${deviceTier}, ramGB=${ramGB.toFixed(1)}, budget=${(chatBudget.availableBytes / (1024 * 1024 * 1024)).toFixed(1)}GB/${chatBudget.source})`,
					);

					// Enable native llama.cpp logging to capture crash details
					await toggleNativeLog(true);
					const _nativeLogSub = addNativeLogListener((level, text) => {
						console.info(`[llama.cpp:${level}] ${text.trimEnd()}`);
					});

					// Try loading with computed GPU layers, retry CPU-only on failure
					const initParams = {
						model: fileUri.length > 60 ? `...${fileUri.slice(-60)}` : fileUri,
						use_mlock: useMlock,
						n_ctx: effectiveContextSize,
						n_gpu_layers: gpuLayers,
						flash_attn: runtime.flash_attn,
						cache_type_k: effectiveCacheTypeK,
						cache_type_v: effectiveCacheTypeV,
						ctx_shift: ctxShift,
					};
					console.info(
						`[WhisperAI:Setup] Calling initLlama() with params:`,
						JSON.stringify(initParams),
					);
					try {
						llamaContext = await initLlama({
							model: fileUri,
							use_mlock: useMlock,
							n_ctx: effectiveContextSize,
							n_gpu_layers: gpuLayers,
							flash_attn: runtime.flash_attn,
							cache_type_k: effectiveCacheTypeK,
							cache_type_v: effectiveCacheTypeV,
							ctx_shift: ctxShift,
						});
						console.info(
							`[WhisperAI:Setup] initLlama() succeeded. Context ID: ${(llamaContext as LlamaContext & { id?: unknown })?.id ?? "unknown"}, model loaded: ${!!llamaContext}`,
						);
					} catch (loadError) {
						console.info(
							`[WhisperAI:Setup] initLlama() FAILED (gpu_layers=${gpuLayers}):`,
							loadError instanceof Error
								? `${loadError.name}: ${loadError.message}`
								: String(loadError),
						);
						if (gpuLayers > 0) {
							console.warn(
								`[WhisperAI:Setup] Load failed with gpu_layers=${gpuLayers}, retrying CPU-only`,
								loadError,
							);
							console.info(
								`[WhisperAI:Setup] Retrying initLlama() with gpu_layers=0, use_mlock=false, flash_attn=false`,
							);
							llamaContext = await initLlama({
								model: fileUri,
								use_mlock: false,
								n_ctx: effectiveContextSize,
								n_gpu_layers: 0,
								flash_attn: false,
								cache_type_k: effectiveCacheTypeK,
								cache_type_v: effectiveCacheTypeV,
								ctx_shift: ctxShift,
							});
							console.info(
								`[WhisperAI:Setup] initLlama() CPU-only retry succeeded. Context ID: ${(llamaContext as LlamaContext & { id?: unknown })?.id ?? "unknown"}`,
							);
						} else {
							throw loadError;
						}
					}
					runtimeConfig = runtime;
					currentContextSize = contextSize;
					stopWords = runtime.stop;

					const modelCardId = store.getCell(
						"aiProviders",
						"whisper-ai",
						"modelCardId",
					) as string | undefined;
					if (modelCardId) {
						store.setCell(
							"aiProviders",
							"whisper-ai",
							"selectedModelId",
							modelCardId,
						);
					}

					// Resolve multimodal capabilities from model card
					let resolvedConstraints: MultimodalConstraints = {
						...DEFAULT_CONSTRAINTS,
					};
					let cardWantsVision = false;
					let cardWantsFiles = false;

					if (cardJson) {
						try {
							const fullCard = JSON.parse(cardJson) as WhisperLLMCard;
							if (fullCard.multimodal) {
								const resolved = await resolveMultimodalConfig(
									fullCard.multimodal,
									device,
								);
								if (resolved) {
									cardWantsVision = resolved.vision?.enabled ?? false;
									cardWantsFiles = resolved.files?.enabled ?? false;
									// Store image token limits for initMultimodal — controls
									// how many tokens the vision encoder allocates per image.
									// Bounding this prevents unbounded GPU/CPU memory allocation.
									storedImageMinTokens =
										resolved.vision?.imageMinTokens ?? undefined;
									resolvedConstraints = {
										maxImageWidth:
											resolved.vision?.maxWidth ??
											DEFAULT_CONSTRAINTS.maxImageWidth,
										maxImageHeight:
											resolved.vision?.maxHeight ??
											DEFAULT_CONSTRAINTS.maxImageHeight,
										imageMaxTokens:
											resolved.vision?.imageMaxTokens ?? undefined,
										maxFileSize:
											resolved.files?.maxSizeBytes ??
											DEFAULT_CONSTRAINTS.maxFileSize,
										maxAudioDuration:
											resolved.audio?.maxDurationSeconds ??
											DEFAULT_CONSTRAINTS.maxAudioDuration,
										supportedImageFormats:
											resolved.vision?.supportedFormats ??
											DEFAULT_CONSTRAINTS.supportedImageFormats,
										supportedFileTypes:
											resolved.files?.supportedTypes ??
											DEFAULT_CONSTRAINTS.supportedFileTypes,
										audioFormat:
											(resolved.audio?.format as "wav" | "mp3") ??
											DEFAULT_CONSTRAINTS.audioFormat,
										audioSampleRate:
											resolved.audio?.sampleRate ??
											DEFAULT_CONSTRAINTS.audioSampleRate,
									};
								}
							}
						} catch (e) {
							console.warn(
								"[WhisperAI] Failed to resolve multimodal config",
								e,
							);
						}
					}

					// Store vision config for on-demand loading (T066)
					_storedConstraints = resolvedConstraints;
					storedCardWantsVision = cardWantsVision;
					storedImageMaxTokens = resolvedConstraints.imageMaxTokens
						? Number(resolvedConstraints.imageMaxTokens)
						: undefined;
					if (cardWantsVision) {
						const mmprojFilename = store.getCell(
							"aiProviders",
							"whisper-ai",
							"mmprojFilename",
						) as string | undefined;
						if (mmprojFilename) {
							storedMmprojUri = `${new FileSystem.Directory(FileSystem.Paths.document).uri}/${mmprojFilename}`;
						}
					}

					// Reset state machine for fresh setup
					resetState();

					// Set initial capabilities — audio always true (whisper.rn bundled),
					// vision deferred to on-demand loading
					updateCapabilities({
						vision: false,
						audio: true,
						files: cardWantsFiles,
						constraints: resolvedConstraints,
					});

					store.setCell("aiProviders", "whisper-ai", "status", "ready");
					store.setCell("aiProviders", "whisper-ai", "error", "");
					console.info("[WhisperAI:Setup] Model loaded — ready");

					// Subscribe to state machine changes to update capabilities reactively
					stateUnsubscribe?.();
					stateUnsubscribe = subscribe((capability, newStatus) => {
						if (capability === "vision") {
							updateCapabilities({
								...resolvedMultimodalCaps,
								vision: newStatus === "ready",
							});
						}
						// STT state changes don't affect audio capability
						// (audio is always true — whisper.rn provides universal transcription)
					});

					// Set up memory pressure release function for centralized handler
					if (llamaContext) {
						const ctx = llamaContext;
						setReleaseMultimodalFn(async () => {
							try {
								await ctx.releaseMultimodal?.();
							} catch (e) {
								console.error("[WhisperAI] releaseMultimodal error:", e);
							}
						});
					}

					// Start centralized memory pressure monitor
					startMemoryPressureMonitor();

					// T067: DeviceMemoryTier-based background pre-warming
					// Run vision and STT pre-warm SEQUENTIALLY (not concurrently) to avoid
					// OOM crashes — after loading a large chat model there isn't enough
					// headroom for both to allocate at the same time.
					const tierStrategy = getDeviceTierStrategy();

					(async () => {
						// 1. Pre-warm vision first (if tier allows and mmproj is available)
						if (
							tierStrategy.preWarmVision &&
							storedCardWantsVision &&
							storedMmprojUri &&
							llamaContext
						) {
							console.info("[WhisperAI] Pre-warming vision");
							try {
								await loadVisionOnDemand(updateCapabilities);
							} catch (err) {
								console.warn("[WhisperAI] Vision pre-warm failed:", err);
							}

							// Small delay to let memory settle before next allocation
							await new Promise((resolve) => setTimeout(resolve, 500));
						}

						// 2. Then pre-warm STT (if tier allows)
						if (tierStrategy.preWarmSTT) {
							console.info("[WhisperAI] Pre-warming STT");
							dispatch("stt", { type: "PRE_WARM" });
							try {
								await initSTT();
								dispatch("stt", { type: "LOAD_SUCCESS" });
								console.info("[WhisperAI] STT pre-warmed successfully");
							} catch (err: unknown) {
								dispatch("stt", {
									type: "LOAD_FAIL_ERROR",
									error: String(err),
								});
								console.warn("[WhisperAI] STT pre-warm failed:", err);
							}
						}
					})().catch((err) => {
						console.warn(
							"[WhisperAI] Sequential pre-warm IIFE failed unexpectedly:",
							err,
						);
					});
				} catch (error) {
					console.error("[WhisperAI] Failed to load model", error);
					const errorMessage =
						error instanceof Error ? error.message : "Failed to load model";
					store.setCell("aiProviders", "whisper-ai", "error", errorMessage);
					store.setCell("aiProviders", "whisper-ai", "status", "error");
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

		async models(_search?: string) {
			const { config } = await fetchLatestRecommendedModel();
			const models: ProviderModel[] = Object.entries(config.cards).map(
				([id, card]) => ({
					id,
					name: card.name,
					description: `${card.sizeGB.toFixed(1)} GB, ${card.parametersB}B params`,
					contextLength: card.runtime?.n_ctx,
				}),
			);
			return models;
		},

		setModel(modelId: string) {
			store.setCell("aiProviders", "whisper-ai", "selectedModelId", modelId);
		},

		async startDownload(restart?: boolean) {
			const cardJson = store.getCell(
				"aiProviders",
				"whisper-ai",
				"modelCard",
			) as string | undefined;
			const cardId = store.getCell(
				"aiProviders",
				"whisper-ai",
				"modelCardId",
			) as string | undefined;
			const configVersion = store.getCell(
				"aiProviders",
				"whisper-ai",
				"configVersion",
			) as string | undefined;

			if (!cardJson || !cardId || !configVersion) {
				throw new Error("No model card configured for download");
			}

			const card = JSON.parse(cardJson) as WhisperLLMCard;
			await startDownload(store, card, cardId, configVersion, restart);
		},

		pauseDownload() {
			pauseDownload(store);
		},

		async resumeDownload() {
			await resumeDownload(store);
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

			const runtime = runtimeConfig;
			const sampling = runtime?.sampling;

			// Convert multimodal parts to llama.rn format
			const convertedMessages = convertToLlamaMessages(
				messages,
				resolvedMultimodalCaps.vision,
			);

			const result = await llamaContext.completion(
				{
					messages: convertedMessages,
					n_predict: runtime?.n_predict ?? -1,
					stop: stopWords,
					temperature: sampling?.temperature,
					top_k: sampling?.top_k,
					top_p: sampling?.top_p,
					min_p: sampling?.min_p,
					penalty_repeat: sampling?.penalty_repeat,
					penalty_last_n: sampling?.penalty_last_n,
					penalty_freq: sampling?.penalty_freq,
					penalty_present: sampling?.penalty_present,
					seed: sampling?.seed,
					enable_thinking: false,
				},
				(data) => {
					onToken(data.token);
				},
			);

			// Map llama.rn result to unified CompletionResult
			let finishReason: CompletionResult["finishReason"];
			if (result.stopped_eos) {
				finishReason = "stop";
			} else if (result.context_full) {
				finishReason = "length";
			} else {
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

		getSystemMessage(conversationMessages: CompletionMessage[]): string {
			const card = getStoredModelCard(store);
			if (card) {
				return processSystemMessage(card, conversationMessages);
			}
			return `You are a 100% private on-device AI chat called Whisper. Conversations stay on the device. Help the user concisely. Be useful, creative, and accurate. Today's date is ${new Date().toLocaleString()}.`;
		},

		getContextSize(): number {
			return currentContextSize;
		},

		getMultimodalCapabilities(): MultimodalCapabilities {
			return resolvedMultimodalCaps;
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
				console.error("[WhisperAI] Error releasing context", error);
			}

			// Complete release transitions
			if (getCapabilityStatus("vision") === "releasing") {
				dispatch("vision", { type: "RELEASE_COMPLETE" });
			}
			if (getCapabilityStatus("stt") === "releasing") {
				dispatch("stt", { type: "RELEASE_COMPLETE" });
			}

			llamaContext = null;
			runtimeConfig = undefined;
			stopWords = [];
			currentContextSize = DEFAULT_CONTEXT_SIZE;
			resolvedMultimodalCaps = NO_MULTIMODAL;
			storedCardWantsVision = false;
			storedMmprojUri = null;
			storedImageMinTokens = undefined;
			storedImageMaxTokens = undefined;
			_storedConstraints = { ...DEFAULT_CONSTRAINTS };
			stateUnsubscribe?.();
			stateUnsubscribe = null;
			setReleaseMultimodalFn(null);
			resetState();
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
	};

	return provider;
}

/**
 * Trigger on-demand vision loading from external code (e.g., chat.tsx).
 * Returns true if vision is now available.
 */
export { loadVisionOnDemand };
