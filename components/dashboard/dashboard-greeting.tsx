import type { ViewStyle } from "react-native";
import type { AnimatedStyle } from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";


interface DashboardGreetingProps {
	chatCount: number;
	animatedStyle: AnimatedStyle<ViewStyle>;
	showUpdateAlert: boolean;
	folderSelectorOffset?: number;
}

export function DashboardGreeting({
	chatCount,
	animatedStyle,
	showUpdateAlert,
	folderSelectorOffset = 0,
}: DashboardGreetingProps) {
	const getGreeting = () => {
		const hour = new Date().getHours();
		if (hour < 5) return "Good night";
		if (hour < 12) return "Good morning";
		if (hour < 17) return "Good afternoon";
		return "Good evening";
	};

	return (
		<Animated.View
			style={[
				{
					position: "absolute",
					top: 128 + 40 + folderSelectorOffset + (showUpdateAlert ? 72 : 0),
					left: 0,
					width: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					alignItems: "center",
					gap: 1,
					paddingHorizontal: 20,
					zIndex: 10,
				},
				animatedStyle,
			]}
		>
			<View
				style={{
					display: "flex",
					alignItems: "center",
					flexDirection: "row",
					gap: 6,
					opacity: 0.75,
				}}
			>
				<Text style={{ fontSize: 18, fontWeight: "500" }}>{getGreeting()}</Text>
				<Text style={{ fontSize: 16 }}>👋</Text>
			</View>

			{chatCount > 0 && (
				<Text style={{ fontSize: 12, opacity: 0.5 }}>
					You have {chatCount} chat{chatCount > 1 && "s"}
				</Text>
			)}
		</Animated.View>
	);
}
