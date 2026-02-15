import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import * as Haptics from "expo-haptics";
import {
	AlertTriangle,
	ChevronRight,
	CircleAlert,
	Info,
} from "lucide-react-native";
import { useCallback } from "react";
import { TouchableOpacity } from "react-native";

interface ChatNoticeProps {
	type: "error" | "warning" | "info";
	message: string;
	actionLabel?: string;
	onAction?: () => void;
}

export function ChatNotice({
	type,
	message,
	actionLabel,
	onAction,
}: ChatNoticeProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const color =
		type === "error"
			? theme.red
			: type === "warning"
				? theme.orange
				: theme.textMuted;
	const Icon =
		type === "error" ? CircleAlert : type === "warning" ? AlertTriangle : Info;

	const handleAction = useCallback(() => {
		if (process.env.EXPO_OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		}
		onAction?.();
	}, [onAction]);

	return (
		<View
			style={{
				padding: 12,
				borderRadius: 16,
				marginBottom: 16,
				gap: 14,
				backgroundColor: theme.card,
			}}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
				}}
			>
				<Icon size={16} color={color} />
				<Text
					style={{
						color,
						fontSize: 14,
						flex: 1,
					}}
				>
					{message}
				</Text>
			</View>
			{actionLabel && onAction && (
				<TouchableOpacity
					onPress={handleAction}
					activeOpacity={0.7}
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "center",
						gap: 4,
						paddingVertical: 8,
						borderRadius: 12,
						backgroundColor: theme.tint,
					}}
				>
					<Text
						style={{
							color: theme.background,
							fontSize: 14,
							fontWeight: "600",
						}}
					>
						{actionLabel}
					</Text>
					<ChevronRight
						size={16}
						color={theme.background}
						strokeWidth={2.5}
					/>
				</TouchableOpacity>
			)}
		</View>
	);
}
