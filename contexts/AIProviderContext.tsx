import { createAllProviders } from "@/src/ai-providers/registry";
import type { AIProvider } from "@/src/ai-providers/types";
import { DEFAULT_LOAD_CONFIG } from "@/src/ai-providers/types";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useStore, useValue } from "tinybase/ui-react";
import type { Store } from "tinybase";

type AIProviderContextType = {
	// Active provider
	activeProvider: AIProvider | null;
	isSettingUp: boolean;
	setupError: string | null;

	// All providers (for UI listing)
	providers: AIProvider[];

	// Management
	setActiveProvider(id: string): Promise<void>;
	enableProvider(id: string): void;
	disableProvider(id: string): Promise<void>;
};

const AIProviderContext = createContext<AIProviderContextType | undefined>(
	undefined,
);

export function AIProviderProvider({ children }: { children: ReactNode }) {
	const store = useStore() as Store;
	const activeProviderId = useValue("activeProviderId") as string | undefined;

	const [isSettingUp, setIsSettingUp] = useState(false);
	const [setupError, setSetupError] = useState<string | null>(null);
	const setupAttemptedRef = useRef<string | null>(null);

	// Create all provider instances (memoized on store reference)
	const providers = useMemo(() => {
		if (!store) return [];
		return createAllProviders(store);
	}, [store]);

	// Find active provider
	const activeProvider = useMemo(() => {
		if (!activeProviderId) return null;
		return providers.find((p) => p.id === activeProviderId) ?? null;
	}, [providers, activeProviderId]);

	// Auto-setup active provider on mount or provider change
	useEffect(() => {
		if (!activeProvider || !store) return;

		const storedStatus = store.getCell(
			"aiProviders",
			activeProvider.id,
			"status",
		) as string | undefined;

		// Setup if stored status indicates a previously-active provider ("ready" or
		// "configuring" — the latter is a transient state that can be persisted if the
		// app crashes/reloads mid-setup) but the runtime isn't configured yet.
		if (
			(storedStatus === "ready" || storedStatus === "configuring") &&
			!activeProvider.isConfigured() &&
			setupAttemptedRef.current !== activeProvider.id
		) {
			console.info("[AIProvider] Starting setup for:", activeProvider.id);
			setupAttemptedRef.current = activeProvider.id;
			setIsSettingUp(true);
			setSetupError(null);

			activeProvider
				.setup()
				.then(() => {
					console.info("[AIProvider] Setup complete for:", activeProvider.id);
					setIsSettingUp(false);
				})
				.catch((error) => {
					console.error("[AIProvider] Setup FAILED for:", activeProvider.id, error);
					setIsSettingUp(false);
					setSetupError(
						error instanceof Error ? error.message : "Setup failed",
					);
				});
		}
	}, [activeProvider, store]);

	const setActiveProvider = useCallback(
		async (id: string) => {
			if (!store) return;

			// Teardown current provider before switching (releases llama context, etc.)
			if (activeProviderId && activeProviderId !== id) {
				const oldProvider = providers.find((p) => p.id === activeProviderId);
				if (oldProvider) {
					try {
						await oldProvider.teardown();
					} catch (err) {
						console.error(`[AIProvider] Teardown error for ${activeProviderId}:`, err);
					}
				}

				// T073: Post-teardown settle delay — allow native mmap unmap to complete
				// before budget checking for new provider setup
				await new Promise((resolve) =>
					setTimeout(resolve, DEFAULT_LOAD_CONFIG.postTeardownSettleMs),
				);
			}

			// Set default model if provider has one and none is selected
			const newProvider = providers.find((p) => p.id === id);
			if (newProvider?.defaultModelId) {
				const currentModelId = store.getCell("aiProviders", id, "selectedModelId") as string | undefined;
				if (!currentModelId) {
					newProvider.setModel(newProvider.defaultModelId);
				}
			}

			setupAttemptedRef.current = null; // Reset so new provider gets setup
			store.setValue("activeProviderId", id);
		},
		[store, activeProviderId, providers],
	);

	const enableProvider = useCallback(
		(id: string) => {
			const provider = providers.find((p) => p.id === id);
			if (provider) {
				provider.enable();
			}
		},
		[providers],
	);

	const disableProvider = useCallback(
		async (id: string) => {
			const provider = providers.find((p) => p.id === id);
			if (provider) {
				// If disabling the active provider, clear active
				if (activeProviderId === id && store) {
					store.setValue("activeProviderId", "");
				}
				await provider.disable();
			}
		},
		[providers, activeProviderId, store],
	);

	const value = useMemo(
		() => ({
			activeProvider,
			isSettingUp,
			setupError,
			providers,
			setActiveProvider,
			enableProvider,
			disableProvider,
		}),
		[
			activeProvider,
			isSettingUp,
			setupError,
			providers,
			setActiveProvider,
			enableProvider,
			disableProvider,
		],
	);

	return (
		<AIProviderContext.Provider value={value}>
			{children}
		</AIProviderContext.Provider>
	);
}

export function useAIProvider() {
	const context = useContext(AIProviderContext);
	if (context === undefined) {
		throw new Error("useAIProvider must be used within an AIProviderProvider");
	}
	return context;
}
