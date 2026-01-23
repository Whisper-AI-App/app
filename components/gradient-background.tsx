import { useColor } from "@/hooks/useColor";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import { ImageBackground } from "expo-image";
import { useEffect, useMemo } from "react";
import { Dimensions, useColorScheme as useRNColorScheme } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { Defs, RadialGradient, Rect, Stop, Svg } from "react-native-svg";
import { View } from "./ui/view";

interface GradientBackgroundProps {
	variant?: "simple" | "animated";
}

export function GradientBackground({
	variant = "simple",
}: GradientBackgroundProps) {
	const scheme = useColorScheme();
	const rnColorScheme = useRNColorScheme() ?? "light";
	const backgroundColor = useColor("background");
	const theme = Colors[rnColorScheme];

	// Gradient animation - animate opacity of bright overlay (only for animated variant)
	const gradientOpacity = useSharedValue(0);

	useEffect(() => {
		if (variant === "animated") {
			gradientOpacity.value = withRepeat(
				withTiming(1, {
					duration: 6000,
					easing: Easing.inOut(Easing.quad),
				}),
				-1,
				true,
			);
		}
	}, [variant]);

	const animatedGradientStyle = useAnimatedStyle(() => ({
		opacity: gradientOpacity.value,
	}));

	// SVG gradient styles (memoized for performance)
	const svgStyle = useMemo(
		() => ({
			position: "absolute" as const,
			top: 0,
			left: 0,
			width: "100%" as const,
			height: Dimensions.get("window").height,
		}),
		[],
	);

	const svgViewBox = useMemo(
		() =>
			`0 0 1 ${Dimensions.get("window").height / Dimensions.get("window").width}`,
		[],
	);

	if (variant === "simple") {
		return (
			<View
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					flex: 1,
					display: "flex",
				}}
			>
				<Svg
					key={scheme}
					style={[
						{
							flex: 1,
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							height: Dimensions.get("window").height,
						},
					]}
					viewBox={svgViewBox}
				>
					<Defs>
						<RadialGradient
							id="radialGradient"
							gradientUnits="objectBoundingBox"
							cx={0.5}
							cy={0.5}
							r={0.75}
						>
							<Stop
								offset="0"
								stopColor="#ff9e37ff"
								stopOpacity={scheme !== "dark" ? 0.9 : 0.95}
							/>
							<Stop
								offset="0.275"
								stopColor="#ff5b91ff"
								stopOpacity={scheme !== "dark" ? 0.9 : 0.9}
							/>
							<Stop
								offset="0.3"
								stopColor="#ff95ffff"
								stopOpacity={scheme !== "dark" ? 0.8 : 0.6}
							/>
							<Stop
								offset="0.325"
								stopColor="#69b7ffff"
								stopOpacity={scheme !== "dark" ? 0.7 : 0.6}
							/>
							<Stop
								offset="0.65"
								stopColor="#0017c2ff"
								stopOpacity={scheme !== "dark" ? 0 : 0}
							/>
							<Stop offset="0.85" stopColor="transparent" stopOpacity={0} />
						</RadialGradient>
					</Defs>
					<Rect
						x={-1.5}
						y={0.125}
						width="4"
						height="4"
						fill="url(#radialGradient)"
					/>
				</Svg>

				<ImageBackground
					source={
						scheme === "dark"
							? require("../assets/images/grain-dark.png")
							: require("../assets/images/grain.png")
					}
					style={{
						flex: 1,
						opacity: scheme === "dark" ? 0.3 : 0.25,
						backgroundColor: backgroundColor,
					}}
				/>
			</View>
		);
	}

	// Animated variant
	return (
		<>
			{/* Background gradient layer - base (dim) */}
			<View
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
				}}
			>
				<Svg style={svgStyle} viewBox={svgViewBox}>
					<Defs>
						<RadialGradient
							id="radialGradientBase"
							gradientUnits="objectBoundingBox"
							cx={0.5}
							cy={0.5}
							r={0.75}
						>
							<Stop offset="0" stopColor="#ff5b91ff" stopOpacity={0.05} />
							<Stop offset="0.15" stopColor="#ff5b91ff" stopOpacity={0.05} />
							<Stop offset="0.2" stopColor="#ff95ffff" stopOpacity={0.025} />
							<Stop offset="0.25" stopColor="#69b7ffff" stopOpacity={0.0125} />
							<Stop offset="0.3" stopColor={theme.card} stopOpacity={0} />
							<Stop offset="0.4" stopColor={theme.background} stopOpacity={1} />
						</RadialGradient>
					</Defs>
					<Rect
						x={-1.5}
						y={0.125}
						width="4"
						height="4"
						fill="url(#radialGradientBase)"
					/>
				</Svg>
			</View>

			{/* Background gradient layer - bright overlay (animated opacity) */}
			<Animated.View
				style={[
					{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
					},
					animatedGradientStyle,
				]}
			>
				<Svg style={svgStyle} viewBox={svgViewBox}>
					<Defs>
						<RadialGradient
							id="radialGradientBright"
							gradientUnits="objectBoundingBox"
							cx={0.5}
							cy={0.5}
							r={0.75}
						>
							<Stop offset="0" stopColor="#ff5b91ff" stopOpacity={0.2} />
							<Stop offset="0.15" stopColor="#ff5b91ff" stopOpacity={0.16} />
							<Stop offset="0.2" stopColor="#ff95ffff" stopOpacity={0.1} />
							<Stop offset="0.25" stopColor="#69b7ffff" stopOpacity={0.05} />
							<Stop offset="0.3" stopColor={theme.card} stopOpacity={0} />
							<Stop
								offset="0.4"
								stopColor={theme.background}
								stopOpacity={0}
							/>
						</RadialGradient>
					</Defs>
					<Rect
						x={-1.5}
						y={0.125}
						width="4"
						height="4"
						fill="url(#radialGradientBright)"
					/>
				</Svg>
			</Animated.View>

			{/* Grain texture overlay */}
			<View
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
				}}
				pointerEvents="none"
			>
				<ImageBackground
					source={
						rnColorScheme === "dark"
							? require("../assets/images/grain-dark.png")
							: require("../assets/images/grain.png")
					}
					style={{
						flex: 1,
						opacity: 0.2,
						backgroundColor: backgroundColor,
					}}
				/>
			</View>
		</>
	);
}
