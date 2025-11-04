import "react-native-get-random-values";
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
import { createExpoFileSystemPersister } from '@mote-software/tinybase-persister-expo-file-system';
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Store } from 'tinybase';
import { Provider, useCreatePersister } from 'tinybase/ui-react';

export default function RootLayout() {
	const [fontsLoaded] = useFonts({
		Inter_400Regular,
		Inter_500Medium,
		Inter_600SemiBold,
	});

	useCreatePersister(
		store as unknown as Store,
		(_store) => createExpoFileSystemPersister(_store, storeFilePath, (error) => {
			console.error('Persister error:', error);
		}),
		[],
		async (persister) => {
			await persister.load();
			await persister.startAutoLoad();
			await persister.startAutoSave();
			initStore(persister)
			console.log("File path:", (persister as ReturnType<typeof createExpoFileSystemPersister>).getFilePath())
		}
	)

	if (!fontsLoaded) {
		return null;
	}

	return (
		<GestureHandlerRootView>
			<Provider store={store as unknown as Store}>
				<AIChatProvider>
					<ThemeProvider>
						<StatusBar />
						<Stack screenOptions={{ headerShown: false }} />
					</ThemeProvider>
				</AIChatProvider>
			</Provider>
		</GestureHandlerRootView>
	);
}
