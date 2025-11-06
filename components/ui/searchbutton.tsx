import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Search } from "lucide-react-native";
import type React from "react";
import { useEffect } from "react";
import {
	ActivityIndicator,
	type GestureResponderEvent,
	type TextStyle,
	TouchableOpacity,
	View,
	type ViewStyle,
} from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { CORNERS, FONT_SIZE, HEIGHT } from "@/theme/globals";

interface SearchButtonProps {
	loading?: boolean;
	label?: string;
	leftIcon?: React.ReactNode;
	rightIcon?: React.ReactNode;
	containerStyle?: ViewStyle | ViewStyle[];
	textStyle?: TextStyle | TextStyle[];
	onPress?: (event: GestureResponderEvent) => void;
	disabled?: boolean;
}

const GRADIENT_COLORS = [
	"#ff9e37",
	"#ff5b91",
	"#ff95ff",
	"#69b7ff",
	"#0017c2",
	"#333333",
];

const BORDER_WIDTH = 2;

export function SearchButton({
	loading = false,
	label = "Search",
	leftIcon,
	rightIcon,
	containerStyle,
	textStyle,
	onPress,
	disabled = false,
}: SearchButtonProps) {
	const cardColor = useColor("card");
	const textColor = useColor("text");
	const muted = useColor("textMuted");
	const icon = useColor("icon");

	// Animation values
	const rotation = useSharedValue(0);

	useEffect(() => {
		rotation.value = withRepeat(
			withTiming(360, {
				duration: 4000,
				easing: Easing.linear,
			}),
			-1, // Infinite repeat
			false,
		);
	}, [rotation]);

	const animatedGradientStyle = useAnimatedStyle(() => ({
		transform: [{ rotate: `${rotation.value}deg` }],
	}));

	const baseStyle: ViewStyle = {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: cardColor,
		height: HEIGHT - BORDER_WIDTH * 2,
		paddingHorizontal: 16,
		borderRadius: CORNERS - BORDER_WIDTH,
		opacity: disabled ? 0.6 : 1,
	};

	const baseTextStyle: TextStyle = {
		flex: 1,
		fontSize: FONT_SIZE,
		color: muted,
		marginHorizontal: 8,
	};

	const handlePress = (event: GestureResponderEvent) => {
		if (!disabled && !loading) {
			if (process.env.EXPO_OS === "ios") {
				Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			}
			onPress?.(event);
		}
	};

	return (
		<View style={containerStyle}>
			{/* Gradient border background - positioned absolutely to fill parent */}
			<View
				style={{
					borderRadius: CORNERS,
					overflow: "hidden",
					padding: BORDER_WIDTH,
				}}
			>
				{/* Rotating gradient layer */}
				<View
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Animated.View
						style={[
							{
								width: 500,
								height: 500,
							},
							animatedGradientStyle,
						]}
					>
						<LinearGradient
							colors={[...GRADIENT_COLORS, GRADIENT_COLORS[0]]}
							locations={[0, 0.166, 0.333, 0.5, 0.666, 0.833, 1]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
							style={{
								width: "100%",
								height: "100%",
							}}
						/>
					</Animated.View>
				</View>

				{/* Button content - creates the "cutout" effect */}
				<TouchableOpacity
					style={baseStyle}
					onPress={handlePress}
					activeOpacity={0.7}
					disabled={disabled || loading}
				>
					{/* Left Icon */}
					{leftIcon || <Icon name={Search} size={16} color={muted} />}

					{/* Label */}
					<Text style={[baseTextStyle, textStyle]} numberOfLines={1}>
						{label}
					</Text>

					{/* Loading Indicator */}
					{loading && (
						<ActivityIndicator
							size="small"
							color={muted}
							style={{ marginRight: 4 }}
						/>
					)}

					{/* Right Icon */}
					{!loading && rightIcon}
				</TouchableOpacity>
			</View>
		</View>
	);
}
