import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { View } from "./view";

interface TypingIndicatorProps {
	isTyping: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
	isTyping,
}) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const dot1Opacity = useRef(new Animated.Value(0)).current;
	const dot2Opacity = useRef(new Animated.Value(0)).current;
	const dot3Opacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (isTyping) {
			const animation = Animated.loop(
				Animated.sequence([
					// Dot 1
					Animated.timing(dot1Opacity, {
						toValue: 1,
						duration: 200,
						useNativeDriver: true,
					}),
					// Dot 2
					Animated.timing(dot2Opacity, {
						toValue: 1,
						duration: 200,
						useNativeDriver: true,
					}),
					// Dot 3
					Animated.timing(dot3Opacity, {
						toValue: 1,
						duration: 200,
						useNativeDriver: true,
					}),
					// Reset all dots
					Animated.parallel([
						Animated.timing(dot1Opacity, {
							toValue: 0,
							duration: 200,
							useNativeDriver: true,
						}),
						Animated.timing(dot2Opacity, {
							toValue: 0,
							duration: 200,
							useNativeDriver: true,
						}),
						Animated.timing(dot3Opacity, {
							toValue: 0,
							duration: 200,
							useNativeDriver: true,
						}),
					]),
				]),
			);

			animation.start();

			return () => {
				animation.stop();
			};
		}
	}, [isTyping, dot1Opacity, dot2Opacity, dot3Opacity]);

	if (!isTyping) return null;

	return (
		<View
			style={[
				{
					padding: 12,
					borderRadius: 16,
					marginLeft: 8,
					marginBottom: 8,
					maxWidth: 100,
				},
				{ backgroundColor: theme.background },
			]}
		>
			<View
				style={{
					flexDirection: "row",
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				{[dot1Opacity, dot2Opacity, dot3Opacity].map((opacity, index) => (
					<Animated.View
						key={index}
						style={[
							{ width: 6, height: 6, borderRadius: 3, marginHorizontal: 3 },
							{ backgroundColor: theme.text, opacity },
						]}
					/>
				))}
			</View>
		</View>
	);
};
