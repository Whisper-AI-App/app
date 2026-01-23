import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { Colors } from "@/theme/colors";
import { Hand } from "lucide-react-native";
import type { ViewStyle } from "react-native";
import { Linking, Pressable, useColorScheme } from "react-native";
import type { AnimatedStyleProp } from "react-native-reanimated";
import Animated from "react-native-reanimated";

interface DashboardGreetingProps {
	chatCount: number;
	animatedStyle: AnimatedStyleProp<ViewStyle>;
	showUpdateAlert: boolean;
}

export function DashboardGreeting({
	chatCount,
	animatedStyle,
	showUpdateAlert,
}: DashboardGreetingProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

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
					top: 128 + 40 + (showUpdateAlert ? 72 : 0),
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
				<Hand
					color={theme.text}
					width={16}
					strokeWidth={2}
					style={{
						width: 8,
						height: 8,
						transform: [{ rotate: "40deg" }],
					}}
				/>
			</View>

			<View
				style={{
					display: "flex",
					flexDirection: "row",
					gap: 12,
					paddingVertical: 6,
				}}
			>
				<Pressable
					onPress={() => Linking.openURL("https://usewhisper.org/news")}
				>
					<Text
						style={{
							display: "flex",
							flexDirection: "row",
							alignItems: "center",
							paddingBottom: 0.05,
							borderBottomColor: "rgba(150,150,150,0.25)",
							borderBottomWidth: 2,
							fontSize: 12,
							color: theme.textMuted,
						}}
					>
						Latest updates
					</Text>
				</Pressable>
				<Pressable
					onPress={() => Linking.openURL("https://usewhisper.org/chat-with-us")}
				>
					<Text
						style={{
							display: "flex",
							flexDirection: "row",
							alignItems: "center",
							paddingBottom: 0.05,
							borderBottomColor: "rgba(150,150,150,0.25)",
							borderBottomWidth: 2,
							fontSize: 12,
							color: theme.textMuted,
						}}
					>
						Request feature
					</Text>
				</Pressable>
			</View>

			{chatCount > 0 && (
				<Text style={{ fontSize: 12, opacity: 0.5 }}>
					You have {chatCount} chat{chatCount > 1 && "s"}
				</Text>
			)}
		</Animated.View>
	);
}
