import { StatusBar } from "@/components/status-bar";
import { ThemeProvider } from "@/theme/theme-provider";
import {
	Inter_400Regular,
	Inter_500Medium,
	Inter_600SemiBold,
	useFonts,
} from "@expo-google-fonts/inter";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

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
			<ThemeProvider>
				<StatusBar />
				<Stack screenOptions={{ headerShown: false }} />
			</ThemeProvider>
		</GestureHandlerRootView>
	);
}
