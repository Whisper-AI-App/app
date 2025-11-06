import { Moon, Sun, SunMoon } from "lucide-react-native";
import { useEffect, useState } from "react";
import Animated, {
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import {
	Button,
	type ButtonSize,
	type ButtonVariant,
} from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useModeToggle } from "@/hooks/useModeToggle";
import { Colors } from "@/theme/colors";

type Props = {
	variant?: ButtonVariant;
	size?: ButtonSize;
	showLabel?: boolean;
};

export const ModeToggle = ({
	variant = "outline",
	size = "icon",
	showLabel = false,
}: Props) => {
	const { toggleMode, isDark, mode } = useModeToggle();
	const rotation = useSharedValue(0);
	const scale = useSharedValue(1);
	const [showIcon, setShowIcon] = useState<"sun" | "moon" | "sunmoon">(
		mode === "system" ? "sunmoon" : isDark ? "moon" : "sun",
	);

	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	useEffect(() => {
		// Animate icon change
		scale.value = withTiming(0, { duration: 150 }, () => {
			runOnJS(setShowIcon)(
				mode === "system" ? "sunmoon" : isDark ? "moon" : "sun",
			);
			scale.value = withTiming(1, { duration: 150 });
		});

		// Only rotate when switching to sun (sun rays spinning effect)
		if (!isDark && mode !== "system") {
			rotation.value = withTiming(rotation.value + 180, { duration: 300 });
		}
	}, [isDark, mode]);

	const animatedStyle = useAnimatedStyle(() => {
		return {
			transform: [
				{
					rotate:
						showIcon === "sun" && mode !== "system"
							? `${rotation.value}deg`
							: "0deg",
				},
				{ scale: scale.value },
			],
		};
	});

	const getModeLabel = () => {
		switch (mode) {
			case "light":
				return "Light";
			case "dark":
				return "Dark";
			case "system":
				return "Auto";
			default:
				return "Auto";
		}
	};

	if (showLabel) {
		return (
			<Button
				variant={variant}
				size="default"
				onPress={toggleMode}
				style={{
					flexDirection: "row",
					justifyContent: "space-between",
					width: "100%",
				}}
			>
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						gap: 2,
						justifyContent: "space-between",
						width: "100%",
					}}
				>
					<Animated.View style={animatedStyle}>
						<Icon
							name={
								showIcon === "sunmoon"
									? SunMoon
									: showIcon === "moon"
										? Moon
										: Sun
							}
							size={20}
						/>
					</Animated.View>
					<Text style={{ fontSize: 15, marginLeft: 6 }}>Theme</Text>
					<Text
						style={{
							fontSize: 15,
							// opacity: 0.6,
							fontWeight: 600,
							marginLeft: "auto",
						}}
					>
						{getModeLabel()}
					</Text>
				</View>
			</Button>
		);
	}

	return (
		<Button variant={variant} size={size} onPress={toggleMode}>
			<Animated.View style={animatedStyle}>
				<Icon
					name={
						showIcon === "sunmoon" ? SunMoon : showIcon === "moon" ? Moon : Sun
					}
					size={24}
				/>
			</Animated.View>
		</Button>
	);
};
