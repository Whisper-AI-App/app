import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "lucide-react-native";
import { useCallback } from "react";
import { Text, TouchableOpacity } from "react-native";

interface ContinueButtonProps {
	onContinue: () => void;
}

export const ContinueButton: React.FC<ContinueButtonProps> = ({
	onContinue,
}) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const handlePress = useCallback(() => {
		if (process.env.EXPO_OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		}
		onContinue();
	}, [onContinue]);

	return (
		<TouchableOpacity
			onPress={handlePress}
			activeOpacity={0.6}
			style={{
				marginLeft: 8,
				marginTop: 4,
				marginBottom: 4,
				padding: 8,
				flexDirection: "row",
				alignItems: "center",
				gap: 4,
			}}
		>
			<ChevronRight size={14} color={theme.textMuted} strokeWidth={2} />
			<Text style={{ color: theme.textMuted, fontSize: 13 }}>Continue</Text>
		</TouchableOpacity>
	);
};
