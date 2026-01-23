import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import type { ModelUpdateInfo } from "@/src/actions/ai/types";
import { Colors } from "@/theme/colors";
import { useColorScheme } from "react-native";

interface UpdateBannerProps {
	updateInfo: ModelUpdateInfo;
	onViewPress: () => void;
}

export function UpdateBanner({ updateInfo, onViewPress }: UpdateBannerProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	return (
		<View
			style={{
				backgroundColor: theme.green,
				paddingVertical: 8,
				paddingHorizontal: 16,
				flexDirection: "row",
				alignItems: "center",
				justifyContent: "space-between",
			}}
		>
			<View style={{ flex: 1 }}>
				<Text
					style={{
						fontSize: 14,
						fontWeight: "600",
						marginBottom: 1,
						color: theme.secondary,
					}}
				>
					{updateInfo.requiresDownload ? "AI Update Available" : "AI Updated!"}
				</Text>
				<Text style={{ fontSize: 12, opacity: 0.9, color: theme.secondary }}>
					{updateInfo.requiresDownload
						? "New version ready to download"
						: "Tap to see what's new"}
				</Text>
			</View>
			<View>
				<Button
					size="sm"
					onPress={onViewPress}
					style={{ paddingHorizontal: 24 }}
					textStyle={{ fontSize: 14 }}
					variant="secondary"
				>
					View
				</Button>
			</View>
		</View>
	);
}
