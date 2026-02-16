import { getModelFileUri, mainStore } from "@/src/stores/main/main-store";
import * as FileSystem from "expo-file-system";
import { initLlama, type LlamaContext, releaseAllLlama } from "llama.rn";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import type { RuntimeConfig } from "whisper-llm-cards";

export type AIChatConfig = {
	ggufPath: string;
	runtime?: RuntimeConfig;
};

export type AIChatMessage = {
	role: "user" | "assistant" | "system";
	content: string;
};

type AIChatContextType = {
	isLoaded: boolean;
	loadModel: (config: AIChatConfig) => Promise<void>;
	completion: (
		messages: AIChatMessage[],
		partialCallback: (token: string) => void,
	) => Promise<string | null>;
	clearCache: () => Promise<void>;
};

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

export function AIChatProvider({ children }: { children: ReactNode }) {
	const [context, setContext] = useState<LlamaContext | undefined>();
	const [isLoaded, setIsLoaded] = useState(false);
	const stopWordsRef = useRef<string[]>([]);
	const runtimeConfigRef = useRef<RuntimeConfig | undefined>(undefined);

	// Validate GGUF file existence on mount
	useEffect(() => {
		// Use helper that reconstructs path from filename (handles app updates)
		const fileUri = getModelFileUri();
		const downloadedAt = mainStore.getValue("ai_chat_model_downloadedAt") as
			| string
			| undefined;

		// Only check if we think we have a downloaded model
		if (fileUri && downloadedAt) {
			const file = new FileSystem.File(fileUri);

			if (!file.exists) {
				console.warn(
					"[AIChatProvider] GGUF file missing, clearing store state",
					fileUri,
				);

				// Clear the store state since file is gone
				mainStore.delValue("ai_chat_model_filename");
				mainStore.delValue("ai_chat_model_fileUri");
				mainStore.delValue("ai_chat_model_downloadedAt");
				mainStore.setValue("ai_chat_model_fileRemoved", true);
			}
		}
	}, []); // Run once on mount

	const loadModel = useCallback(
		async (config: AIChatConfig) => {
			if (context) {
				throw new Error(
					"Model already loaded. Release current model before loading a new one.",
				);
			}

			console.log("[AIChatProvider] Loading model", config.ggufPath);

			try {
				await releaseAllLlama();
			} catch (error) {
				console.error(
					"[AIChatProvider] Trouble releasing any existing context",
					error,
				);
			}

			if (!new FileSystem.File(config.ggufPath).exists) {
				console.error("[AIChatProvider] gguf path does not exist");
				throw new Error("[AIChatProvider] gguf path does not exist");
			}

			try {
				const runtime = config.runtime;
				const isAndroid = process.env.EXPO_OS === "android";

				const llamaContext = await initLlama({
					model: config.ggufPath,
					use_mlock: !isAndroid, // mlock can fail on Android without permissions
					n_ctx: runtime?.n_ctx ?? 4096,
					n_gpu_layers: isAndroid ? 0 : 99, // GPU layers can cause issues on some Android devices
					flash_attn: runtime?.flash_attn,
					cache_type_k: runtime?.cache_type_k,
					cache_type_v: runtime?.cache_type_v,
				});

				console.log(
					"[AIChatProvider] Model Meta:",
					llamaContext.model.metadata,
				);

				setContext(llamaContext);
				setIsLoaded(true);
				runtimeConfigRef.current = runtime;
				stopWordsRef.current = runtime?.stop ?? [];

				console.log("[AIChatProvider] Model loaded successfully");
			} catch (error) {
				console.error("[AIChatProvider] Failed to load model", error);
				throw error;
			}
		},
		[context],
	);

	const completion = useCallback(
		async (
			messages: AIChatMessage[],
			partialCallback: (token: string) => void,
		) => {
			if (!context) {
				console.warn("[AIChatProvider] No model loaded");
				return null;
			}

			const runtime = runtimeConfigRef.current;
			const sampling = runtime?.sampling ?? {};

			const result = await context.completion(
				{
					messages,
					n_predict: runtime?.n_predict ?? -1,
					stop: stopWordsRef.current,

					// Sampling params - llama.rn uses these exact names
					temperature: sampling.temperature,
					top_k: sampling.top_k,
					top_p: sampling.top_p,
					min_p: sampling.min_p,
					penalty_repeat: sampling.penalty_repeat,
					penalty_last_n: sampling.penalty_last_n,
					seed: sampling.seed,
				},
				(data) => {
					partialCallback(data.token);
				},
			);

			return result.content;
		},
		[context],
	);

	// Auto-detect hybrid/recurrent models from llama.rn context
	const clearCache = useCallback(async () => {
		if (!context) return;
		// llama.rn exposes model.is_hybrid and model.is_recurrent after load
		const model = context.model as {
			is_hybrid?: boolean;
			is_recurrent?: boolean;
		};
		if (model.is_hybrid || model.is_recurrent) {
			await context.clearCache(false);
			console.log("[AIChatProvider] Cache cleared for hybrid/recurrent model");
		}
	}, [context]);

	return (
		<AIChatContext.Provider
			value={{ isLoaded, loadModel, completion, clearCache }}
		>
			{children}
		</AIChatContext.Provider>
	);
}

export function useAIChat() {
	const context = useContext(AIChatContext);
	if (context === undefined) {
		throw new Error("useAIChat must be used within an AIChatProvider");
	}
	return context;
}
