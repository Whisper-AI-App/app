import type { Store } from "tinybase";
import type { AIProvider, AIProviderFactory } from "./types";
import { createOpenRouterProvider } from "./openrouter/provider";
import { createWhisperAIProvider } from "./whisper-ai/provider";

// Adding a new provider = add one line here
export const PROVIDER_FACTORIES: AIProviderFactory[] = [
	createWhisperAIProvider,
	createOpenRouterProvider,
];

// Create all provider instances from store
export function createAllProviders(store: Store): AIProvider[] {
	return PROVIDER_FACTORIES.map((factory) => factory(store));
}
