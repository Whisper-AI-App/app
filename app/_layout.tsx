import { AuthGate } from "@/components/auth-gate";
import { ErrorBoundary } from "@/components/error-boundary";
import { MigrationErrorScreen } from "@/components/migration-error-screen";
import { StatusBar } from "@/components/status-bar";
import { AIProviderProvider } from "@/contexts/AIProviderContext";
import { resetEverything } from "@/src/actions/reset";
import {
	initMainStore,
	mainStore,
	mainStoreFilePath,
} from "@/src/stores/main/main-store";
import { runMigrations } from "@/src/stores/main/migrations";
import { ThemeProvider } from "@/theme/theme-provider";
import {
	Inter_400Regular,
	Inter_500Medium,
	Inter_600SemiBold,
	useFonts,
} from "@expo-google-fonts/inter";
import { createExpoFileSystemPersister } from "@mote-software/tinybase-persister-expo-file-system";
import { Stack } from "expo-router";
import { useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-get-random-values";
import type { Store } from "tinybase";
import { Provider, useCreatePersister } from "tinybase/ui-react";

export default function RootLayout() {
	const [fontsLoaded] = useFonts({
		Inter_400Regular,
		Inter_500Medium,
		Inter_600SemiBold,
	});

	const [migrationError, setMigrationError] = useState<Error | null>(null);

	useCreatePersister(
		mainStore as unknown as Store,
		(_store) =>
			createExpoFileSystemPersister(_store, mainStoreFilePath, (error) => {
				console.error("Persister error:", error);
			}),
		[],
		async (persister) => {
			await persister.load();

			// Run migrations after load but before auto-save starts
			const result = await runMigrations(mainStore as unknown as Store);

			console.info("[State] Finished migrations. status:", result);

			if (!result.success) {
				setMigrationError(
					result.error || new Error("Migration failed unexpectedly"),
				);
				return; // Don't start auto-save with corrupted state
			}

			// Save migrated state before starting auto-load to prevent file from
			// overwriting in-memory migrations
			if (result.migrationsRun > 0) {
				await persister.save();
			}

			await persister.startAutoLoad();
			await persister.startAutoSave();
			initMainStore();
		},
	);

	if (!fontsLoaded) {
		return null;
	}

	// Show migration error screen if migrations failed
	if (migrationError) {
		return (
			<MigrationErrorScreen error={migrationError} onReset={resetEverything} />
		);
	}

	return (
		<GestureHandlerRootView>
			<Provider store={mainStore as unknown as Store}>
				<AuthGate>
					<ErrorBoundary>
						<AIProviderProvider>
							<ThemeProvider>
								<StatusBar />
								<ErrorBoundary>
									<Stack screenOptions={{ headerShown: false }}>
										<Stack.Screen name="index" />
										<Stack.Screen name="download" />
										<Stack.Screen name="dashboard" />
										<Stack.Screen name="settings" />
										<Stack.Screen name="chat" />
										<Stack.Screen name="game" />
										<Stack.Screen name="setup-ai" />
									<Stack.Screen name="provider-setup/[providerId]" />
										<Stack.Screen name="callback/[provider]" />
									</Stack>
								</ErrorBoundary>
							</ThemeProvider>
						</AIProviderProvider>
					</ErrorBoundary>
				</AuthGate>
			</Provider>
		</GestureHandlerRootView>
	);
}
