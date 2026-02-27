import { createAllProviders } from "@/src/ai-providers/registry";
import type { AIProvider } from "@/src/ai-providers/types";
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
	setActiveProvider(id: string): void;
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

		// Only setup if stored status is "ready" (persisted from previous session)
		// but runtime isn't configured yet, OR if status is "configuring"
		if (
			storedStatus === "ready" &&
			!activeProvider.isConfigured() &&
			setupAttemptedRef.current !== activeProvider.id
		) {
			setupAttemptedRef.current = activeProvider.id;
			setIsSettingUp(true);
			setSetupError(null);

			activeProvider
				.setup()
				.then(() => {
					setIsSettingUp(false);
				})
				.catch((error) => {
					setIsSettingUp(false);
					setSetupError(
						error instanceof Error ? error.message : "Setup failed",
					);
				});
		}
	}, [activeProvider, store]);

	const setActiveProvider = useCallback(
		(id: string) => {
			if (!store) return;

			// Teardown current provider before switching (releases llama context, etc.)
			if (activeProviderId && activeProviderId !== id) {
				const oldProvider = providers.find((p) => p.id === activeProviderId);
				if (oldProvider) {
					oldProvider.teardown().catch((err) =>
						console.error(`[AIProvider] Teardown error for ${activeProviderId}:`, err),
					);
				}
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

	return (
		<AIProviderContext.Provider
			value={{
				activeProvider,
				isSettingUp,
				setupError,
				providers,
				setActiveProvider,
				enableProvider,
				disableProvider,
			}}
		>
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
