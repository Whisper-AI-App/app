import { getModelFileUri, mainStore } from "@/src/stores/main/main-store";
import type { CompletionResult } from "@/src/types/chat";
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

export type AIChatConfig = { ggufPath: string; stopWords?: string[] };

export type AIChatMessage = {
	role: "user" | "system" | "assistant";
	content: string;
};

type AIChatContextType = {
	isLoaded: boolean;
	loadModel: (config: AIChatConfig) => Promise<void>;
	completion: (
		messages: AIChatMessage[],
		partialCallback: (token: string) => void,
	) => Promise<CompletionResult | null>;
};

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

export function AIChatProvider({ children }: { children: ReactNode }) {
	const [context, setContext] = useState<LlamaContext | undefined>();
	const [isLoaded, setIsLoaded] = useState(false);
	const stopWordsRef = useRef<string[]>([]);

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
				const isAndroid = process.env.EXPO_OS === "android";
				const llamaContext = await initLlama({
					model: config.ggufPath,
					use_mlock: !isAndroid, // mlock can fail on Android without permissions
					n_ctx: 2048,
					n_gpu_layers: isAndroid ? 0 : 99, // GPU layers can cause issues on some Android devices
				});

				setContext(llamaContext);
				setIsLoaded(true);
				stopWordsRef.current = config.stopWords || [];

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

			const result = await context.completion(
				{
					messages,
					n_predict: 500,
					stop: stopWordsRef.current,
				},
				(data) => {
					partialCallback(data.token);
				},
			);

			return {
				content: result.content,
				stopped_eos: result.stopped_eos,
				stopped_limit: result.stopped_limit,
				context_full: result.context_full,
				truncated: result.truncated,
				tokens_predicted: result.tokens_predicted,
				tokens_evaluated: result.tokens_evaluated,
			};
		},
		[context],
	);

	return (
		<AIChatContext.Provider value={{ isLoaded, loadModel, completion }}>
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
