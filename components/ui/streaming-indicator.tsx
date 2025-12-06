import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { Text } from "./text";

export const StreamingIndicator: React.FC = () => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const pulseAnim = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		const animation = Animated.loop(
			Animated.sequence([
				Animated.timing(pulseAnim, {
					toValue: 0.3,
					duration: 800,
					useNativeDriver: true,
				}),
				Animated.timing(pulseAnim, {
					toValue: 1,
					duration: 800,
					useNativeDriver: true,
				}),
			]),
		);

		animation.start();

		return () => {
			animation.stop();
		};
	}, [pulseAnim]);

	return (
		<Animated.View
			style={{
				marginLeft: 8,
				marginTop: -8,
				marginBottom: 8,
				opacity: pulseAnim,
			}}
		>
			<Text
				style={{
					fontSize: 11,
					color: theme.textMuted,
					fontStyle: "italic",
				}}
			>
				Generating...
			</Text>
		</Animated.View>
	);
};
