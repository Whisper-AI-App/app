import { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withSpring,
	withTiming,
} from "react-native-reanimated";
import { useColor } from "@/hooks/useColor";

interface ProgressProps {
	value: number; // 0 to 1
	height?: number;
	backgroundColor?: string;
	progressColor?: string;
	style?: ViewStyle;
	animated?: boolean;
}

export function Progress({
	value,
	height = 8,
	backgroundColor,
	progressColor,
	style,
	animated = true,
}: ProgressProps) {
	const defaultBgColor = useColor("background");
	const defaultProgressColor = useColor("primary");

	const progress = useSharedValue(0);

	useEffect(() => {
		const clampedValue = Math.max(0, Math.min(1, value));
		if (animated) {
			progress.value = withSpring(clampedValue, {
				damping: 15,
				stiffness: 100,
			});
		} else {
			progress.value = withTiming(clampedValue, { duration: 0 });
		}
	}, [value, animated]);

	const animatedStyle = useAnimatedStyle(() => {
		return {
			width: `${progress.value * 100}%`,
		};
	});

	return (
		<View
			style={[
				{
					height,
					backgroundColor: backgroundColor || defaultBgColor,
					borderRadius: height / 2,
					overflow: "hidden",
					width: "100%",
				},
				style,
			]}
		>
			<Animated.View
				style={[
					{
						height: "100%",
						backgroundColor: progressColor || defaultProgressColor,
						borderRadius: height / 2,
					},
					animatedStyle,
				]}
			/>
		</View>
	);
}
