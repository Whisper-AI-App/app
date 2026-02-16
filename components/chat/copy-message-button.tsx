import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Check, Copy } from "lucide-react-native";
import { useCallback, useState } from "react";
import { TouchableOpacity } from "react-native";

interface CopyMessageButtonProps {
	text: string;
	variant?: "assistant" | "user";
}

export const CopyMessageButton: React.FC<CopyMessageButtonProps> = ({
	text,
	variant = "assistant",
}) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const [isCopied, setIsCopied] = useState(false);

	const handleCopy = useCallback(async () => {
		await Clipboard.setStringAsync(text);
		if (process.env.EXPO_OS === "ios") {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		}
		setIsCopied(true);

		// Reset after 2 seconds
		setTimeout(() => {
			setIsCopied(false);
		}, 2000);
	}, [text]);

	return (
		<TouchableOpacity
			onPress={handleCopy}
			activeOpacity={0.6}
			style={{
				marginLeft: 8,
				marginTop: 4,
				marginBottom: 4,
				padding: 8,
			}}
		>
			{isCopied ? (
				<Check size={14} color="#22c55e" strokeWidth={2.5} />
			) : (
				<Copy size={14} color={variant === "user" ? `${theme.background}99` : theme.textMuted} strokeWidth={2} />
			)}
		</TouchableOpacity>
	);
};
