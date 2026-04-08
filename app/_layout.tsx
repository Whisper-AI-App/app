import { AuthGate } from "@/components/auth-gate";
import { ErrorBoundary } from "@/components/error-boundary";
import { StatusBar } from "@/components/status-bar";
import { StoreProvider } from "@/components/StoreProvider";
import { AIProviderProvider } from "@/contexts/AIProviderContext";
import { mainStore } from "@/src/stores/main/main-store";
import { registerBuiltInSkills } from "@/src/tools/skills";

// Register tool skills at module load time
registerBuiltInSkills();
import { ThemeProvider } from "@/theme/theme-provider";
import {
	Inter_400Regular,
	Inter_500Medium,
	Inter_600SemiBold,
	useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-get-random-values";
import type { Store } from "tinybase";
import { Provider } from "tinybase/ui-react";

export default function RootLayout() {
	const [fontsLoaded] = useFonts({
		Inter_400Regular,
		Inter_500Medium,
		Inter_600SemiBold,
	});

	if (!fontsLoaded) {
		return null;
	}

	return (
		<GestureHandlerRootView>
			<Provider store={mainStore as unknown as Store}>
				<StoreProvider>
					<AuthGate>
						<ErrorBoundary>
							<AIProviderProvider>
								<ThemeProvider>
									<StatusBar />
									<ErrorBoundary>
										<Stack screenOptions={{ headerShown: false }}>
											<Stack.Screen name="index" />
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
				</StoreProvider>
			</Provider>
		</GestureHandlerRootView>
	);
}
