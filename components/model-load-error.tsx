import { useColorScheme } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { Colors } from "@/theme/colors";

type ModelLoadErrorProps = {
	onRetry: () => void;
};

export function ModelLoadError({ onRetry }: ModelLoadErrorProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	return (
		<View
			style={{
				backgroundColor: theme.destructive,
				paddingHorizontal: 16,
				paddingVertical: 12,
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 12,
			}}
		>
			<View style={{ flex: 1 }}>
				<Text
					style={{
						color: theme.destructiveForeground,
						fontWeight: 600,
						fontSize: 14,
					}}
				>
					Oh no! Couldn't load AI.
				</Text>
				<Text
					style={{
						color: theme.destructiveForeground,
						fontSize: 12,
					}}
				>
					Tap retry, or close and re-open the app.
				</Text>
			</View>
			<Button
				onPress={onRetry}
				variant="outline"
				size="sm"
				style={{
					borderColor: theme.destructiveForeground,
					paddingHorizontal: 16,
					paddingVertical: 6,
				}}
			>
				<Text
					style={{
						color: theme.destructiveForeground,
						fontSize: 13,
						paddingHorizontal: 12,
					}}
				>
					Retry
				</Text>
			</Button>
		</View>
	);
}
