import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import {
	authenticate,
	checkLocalAuthAvailable,
	setLocalAuth,
} from "@/src/actions/settings";
import { Colors } from "@/theme/colors";
import { Shield } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Switch, useColorScheme } from "react-native";
import { useValue } from "tinybase/ui-react";

function LocalAuthStepIcon() {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	return (
		<Icon
			name={Shield}
			size={128}
			lightColor={theme.primaryForeground}
			darkColor={theme.primaryForeground}
			strokeWidth={1.35}
		/>
	);
}

export function LocalAuthStepContent() {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const localAuthEnabled = useValue("localAuthEnabled") as boolean | undefined;
	const [isEnabled, setIsEnabled] = useState(localAuthEnabled === true);
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

	useEffect(() => {
		checkLocalAuthAvailable().then((result) => {
			setIsAvailable(result.available);
			if (!result.available) {
				if (!result.hasHardware) {
					setStatusMessage(
						"Biometric authentication not available on this device",
					);
				} else if (!result.isEnrolled) {
					setStatusMessage(
						"No biometric data enrolled. Set up in device settings.",
					);
				}
			}
		});
	}, []);

	const handleToggle = async (value: boolean) => {
		if (value) {
			// Enabling - verify auth works first
			setIsAuthenticating(true);
			setStatusMessage(null);

			const result = await authenticate();

			setIsAuthenticating(false);

			if (result.success) {
				setIsEnabled(true);
				setLocalAuth(true);
				setStatusMessage("Authentication enabled");
			} else {
				setIsEnabled(false);
				setStatusMessage(result.error || "Authentication failed");
			}
		} else {
			// Disabling - no auth check needed
			setIsEnabled(false);
			setLocalAuth(false);
			setStatusMessage(null);
		}
	};

	return (
		<View
			style={{
				width: "100%",
				alignItems: "center",
				paddingHorizontal: 20,
			}}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					width: "100%",
					paddingHorizontal: 16,
					paddingVertical: 14,
					borderRadius: 12,
				}}
			>
				<Text
					style={{
						fontSize: 16,
						fontWeight: "500",
						color: theme.primary,
					}}
				>
					Enable Lock Screen
				</Text>
				<Switch
					value={isAuthenticating || isEnabled}
					onValueChange={handleToggle}
					disabled={isAuthenticating || isAvailable === false}
				/>
			</View>

			{statusMessage && (
				<Text
					style={{
						fontSize: 13,
						color: theme.text,
						marginTop: 12,
						textAlign: "center",
					}}
				>
					{statusMessage}
				</Text>
			)}

			{isAuthenticating && (
				<Text
					style={{
						fontSize: 13,
						color: theme.text,
						marginTop: 12,
						textAlign: "center",
					}}
				>
					Verifying...
				</Text>
			)}
		</View>
	);
}
