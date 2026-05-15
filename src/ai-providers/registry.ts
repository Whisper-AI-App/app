import { Platform } from "react-native";
import type { Store } from "tinybase";
import { createCustomProvider } from "./custom-provider/provider";
import { createHuggingFaceProvider } from "./huggingface/provider";
import type { AIProvider, AIProviderFactory } from "./types";
import { createWhisperAIProvider } from "./whisper-ai/provider";

// Adding a new provider = add one line here
export const PROVIDER_FACTORIES: AIProviderFactory[] = [
	createWhisperAIProvider,
	createHuggingFaceProvider,

	...(Platform.OS === "ios"
		? (() => {
				try {
					const {
						createAppleModelsProvider,
					} = require("./apple-models/provider");
					return [createAppleModelsProvider];
				} catch {
					// Package not available or native module missing, skip silently
					return [];
				}
			})()
		: []),

	createCustomProvider,
];

// Create all provider instances from store
export function createAllProviders(store: Store): AIProvider[] {
	return PROVIDER_FACTORIES.map((factory) => factory(store));
}
