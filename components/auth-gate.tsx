import { authenticate } from "@/src/actions/settings";
import { sessionStore } from "@/src/stores/session/session-store";
import { Colors } from "@/theme/colors";
import { Lock } from "lucide-react-native";
import { useCallback, useState } from "react";
import { useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useValue } from "tinybase/ui-react";
import { GradientBackground } from "./gradient-background";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";
import { View } from "./ui/view";

interface AuthGateProps {
	children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
	const localAuthEnabled = useValue("localAuthEnabled") as boolean | undefined;
	const [isAuthenticated, setIsAuthenticated] = useState(
		() => sessionStore.getValue("isAuthenticated") as boolean,
	);
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [authError, setAuthError] = useState<string | null>(null);

	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const handleAuthenticate = useCallback(async () => {
		setIsAuthenticating(true);
		setAuthError(null);

		const result = await authenticate();

		setIsAuthenticating(false);

		if (result.success) {
			sessionStore.setValue("isAuthenticated", true);
			setIsAuthenticated(true);
		} else {
			setAuthError(result.error || "Authentication failed");
		}
	}, []);

	// If local auth is not enabled, render children directly
	if (!localAuthEnabled) {
		return <>{children}</>;
	}

	// If authenticated, render children
	if (isAuthenticated) {
		return <>{children}</>;
	}

	// Show lock screen
	return (
		<View style={{ flex: 1, backgroundColor: theme.background }}>
			<GradientBackground variant="animated" />

			<SafeAreaView style={{ flex: 1 }}>
				<View
					style={{
						flex: 1,
						justifyContent: "center",
						alignItems: "center",
						paddingHorizontal: 32,
					}}
				>
					<View
						style={{
							alignItems: "center",
							marginBottom: 48,
						}}
					>
						<View
							style={{
								width: 80,
								height: 80,
								borderRadius: 40,
								backgroundColor: theme.secondary,
								justifyContent: "center",
								alignItems: "center",
								marginBottom: 24,
							}}
						>
							<Icon
								name={Lock}
								size={36}
								lightColor={theme.text}
								darkColor={theme.text}
							/>
						</View>
						<Text
							style={{
								fontSize: 24,
								fontWeight: "600",
								marginBottom: 8,
								textAlign: "center",
							}}
						>
							Whisper is Locked
						</Text>
						<Text
							style={{
								fontSize: 15,
								opacity: 0.6,
								textAlign: "center",
								lineHeight: 22,
							}}
						>
							Use Face ID, Touch ID, or your device passcode to unlock
						</Text>
					</View>

					{authError && (
						<Text
							style={{
								fontSize: 14,
								color: theme.red,
								textAlign: "center",
								marginBottom: 16,
							}}
						>
							{authError}
						</Text>
					)}

					<Button
						onPress={handleAuthenticate}
						loading={isAuthenticating}
						disabled={isAuthenticating}
						style={{ minWidth: 160 }}
					>
						Unlock
					</Button>
				</View>
			</SafeAreaView>
		</View>
	);
}
