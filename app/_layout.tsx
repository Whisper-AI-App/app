import { AuthGate } from "@/components/auth-gate";
import { StatusBar } from "@/components/status-bar";
import { AIChatProvider } from "@/contexts/AIChatContext";
import { initStore, store, storeFilePath } from "@/src/store";
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
		store as unknown as Store,
		(_store) =>
			createExpoFileSystemPersister(_store, storeFilePath, (error) => {
				console.error("Persister error:", error);
			}),
		[],
		async (persister) => {
			await persister.load();
			await persister.startAutoLoad();
			await persister.startAutoSave();
			initStore(persister);
			console.log(
				"File path:",
				(
					persister as ReturnType<typeof createExpoFileSystemPersister>
				).getFilePath(),
			);
		},
	);

	if (!fontsLoaded) {
		return null;
	}

	return (
		<GestureHandlerRootView>
			<Provider store={store as unknown as Store}>
				<AuthGate>
					<AIChatProvider>
						<ThemeProvider>
							<StatusBar />
							<Stack screenOptions={{ headerShown: false }}>
								<Stack.Screen name="index" />
								<Stack.Screen name="download" />
								<Stack.Screen name="dashboard" />
								<Stack.Screen name="settings" />
								<Stack.Screen name="chat" />
							</Stack>
						</ThemeProvider>
					</AIChatProvider>
				</AuthGate>
			</Provider>
		</GestureHandlerRootView>
	);
}
