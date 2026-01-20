import { AuthGate } from "@/components/auth-gate";
import { ErrorBoundary } from "@/components/error-boundary";
import { StatusBar } from "@/components/status-bar";
import { AIChatProvider } from "@/contexts/AIChatContext";
import {
	initMainStore,
	mainStore,
	mainStoreFilePath,
} from "@/src/stores/main/main-store";
import { ThemeProvider } from "@/theme/theme-provider";
import {
	Inter_400Regular,
	Inter_500Medium,
	Inter_600SemiBold,
	useFonts,
} from "@expo-google-fonts/inter";
import { createExpoFileSystemPersister } from "@mote-software/tinybase-persister-expo-file-system";
import { Stack } from "expo-router";
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

	useCreatePersister(
		mainStore as unknown as Store,
		(_store) =>
			createExpoFileSystemPersister(_store, mainStoreFilePath, (error) => {
				console.error("Persister error:", error);
			}),
		[],
		async (persister) => {
			await persister.load();
			await persister.startAutoLoad();
			await persister.startAutoSave();
			initMainStore();
		},
	);

	if (!fontsLoaded) {
		return null;
	}

	return (
		<GestureHandlerRootView>
			<Provider store={mainStore as unknown as Store}>
				<AuthGate>
					<ErrorBoundary>
						<AIChatProvider>
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
									</Stack>
								</ErrorBoundary>
							</ThemeProvider>
						</AIChatProvider>
					</ErrorBoundary>
				</AuthGate>
			</Provider>
		</GestureHandlerRootView>
	);
}
