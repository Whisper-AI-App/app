import type { Store } from "tinybase";
import { Platform } from "react-native";
import { createCustomProvider } from "./custom-provider/provider";
import { createOpenAIProvider } from "./openai/provider";
import { createOpenRouterProvider } from "./openrouter/provider";
import type { AIProvider, AIProviderFactory } from "./types";
import { createWhisperAIProvider } from "./whisper-ai/provider";

// Adding a new provider = add one line here
export const PROVIDER_FACTORIES: AIProviderFactory[] = [
	createWhisperAIProvider,
	createOpenRouterProvider,
	createOpenAIProvider,
	createCustomProvider,
];

// Conditional: only register Apple Models on compatible iOS devices
if (Platform.OS === "ios") {
	try {
		const { apple } = require("@react-native-ai/apple");
		if (apple.isAvailable()) {
			const { createAppleModelsProvider } = require("./apple-models/provider");
			PROVIDER_FACTORIES.push(createAppleModelsProvider);
		}
	} catch {
		// Package not available or native module missing, skip silently
	}
}

// Create all provider instances from store
export function createAllProviders(store: Store): AIProvider[] {
	return PROVIDER_FACTORIES.map((factory) => factory(store));
}
