import * as FileSystem from "expo-file-system";
import { initLlama, type LlamaContext, releaseAllLlama } from "llama.rn";
import React, {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { store } from "@/src/store";

export type AIChatConfig = { ggufPath: string; stopWords?: string[] };

export type AIChatMessage = {
	role: "user" | "system";
	content: string;
};

type AIChatContextType = {
	isLoaded: boolean;
	loadModel: (config: AIChatConfig) => Promise<void>;
	completion: (
		messages: AIChatMessage[],
		partialCallback: (token: string) => void,
	) => Promise<string | null>;
};

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

export function AIChatProvider({ children }: { children: ReactNode }) {
	const [context, setContext] = useState<LlamaContext | undefined>();
	const [isLoaded, setIsLoaded] = useState(false);
	const stopWordsRef = useRef<string[]>([]);

	// Validate GGUF file existence on mount and when fileUri changes
	useEffect(() => {
		const fileUri = store.getValue("ai_chat_model_fileUri") as
			| string
			| undefined;
		const downloadedAt = store.getValue("ai_chat_model_downloadedAt") as
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
				store.delValue("ai_chat_model_fileUri");
				store.delValue("ai_chat_model_downloadedAt");
				store.setValue("ai_chat_model_fileRemoved", true);
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
				const llamaContext = await initLlama({
					model: config.ggufPath,
					use_mlock: true,
					n_ctx: 2048,
					n_gpu_layers: 99,
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
					n_predict: 300,
					stop: stopWordsRef.current,
				},
				(data) => {
					partialCallback(data.token);
				},
			);

			return result.content;
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
