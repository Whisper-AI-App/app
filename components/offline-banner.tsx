import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { Colors } from "@/theme/colors";
import { WifiOff } from "lucide-react-native";
import { useColorScheme } from "react-native";

export function OfflineBanner() {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "center",
				gap: 8,
				paddingVertical: 8,
				paddingHorizontal: 16,
				backgroundColor: "rgba(255,150,0,0.15)",
			}}
		>
			<WifiOff color={theme.textMuted} size={14} strokeWidth={2} />
			<Text style={{ fontSize: 12, color: theme.textMuted }}>
				You're offline. Cloud AI providers need an internet connection.
			</Text>
		</View>
	);
}
