import type { Store } from "tinybase";
import { createCustomProvider } from "./custom-provider/provider";
import { createHuggingFaceProvider } from "./huggingface/provider";
import { createOpenRouterProvider } from "./openrouter/provider";
import type { AIProvider, AIProviderFactory } from "./types";
import { createWhisperAIProvider } from "./whisper-ai/provider";

// Adding a new provider = add one line here
export const PROVIDER_FACTORIES: AIProviderFactory[] = [
	createWhisperAIProvider,
	createOpenRouterProvider,
	createCustomProvider,
	createHuggingFaceProvider,
];

// Create all provider instances from store
export function createAllProviders(store: Store): AIProvider[] {
	return PROVIDER_FACTORIES.map((factory) => factory(store));
}
