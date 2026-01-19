import { authenticate } from "@/src/actions/settings";
import { sessionStore } from "@/src/stores/session/session-store";
import { Colors } from "@/theme/colors";
import { ImageBackground } from "expo-image";
import { Lock } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, useColorScheme } from "react-native";
import Animated, {
	Easing,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Defs, RadialGradient, Rect, Stop, Svg } from "react-native-svg";
import { useValue } from "tinybase/ui-react";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";
import { Text } from "./ui/text";
import { View } from "./ui/view";

interface AuthGateProps {
	children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
	const localAuthEnabled = useValue("localAuthEnabled") as boolean | undefined;
	const [isAuthenticated, setIsAuthenticated] = useState(
		() => sessionStore.getValue("isAuthenticated") as boolean,
	);
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [authError, setAuthError] = useState<string | null>(null);

	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	// Gradient animation - animate opacity of bright overlay
	const gradientOpacity = useSharedValue(0);

	useEffect(() => {
		gradientOpacity.value = withRepeat(
			withTiming(1, {
				duration: 6000,
				easing: Easing.inOut(Easing.quad),
			}),
			-1,
			true,
		);
	}, []);

	const animatedGradientStyle = useAnimatedStyle(() => ({
		opacity: gradientOpacity.value,
	}));

	// SVG gradient styles
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
			`0 0 1 ${
				Dimensions.get("window").height / Dimensions.get("window").width
			}`,
		[],
	);

	const handleAuthenticate = useCallback(async () => {
		setIsAuthenticating(true);
		setAuthError(null);

		const result = await authenticate();

		setIsAuthenticating(false);

		if (result.success) {
			sessionStore.setValue("isAuthenticated", true);
			setIsAuthenticated(true);
		} else {
			setAuthError(result.error || "Authentication failed");
		}
	}, []);

	// If local auth is not enabled, render children directly
	if (!localAuthEnabled) {
		return <>{children}</>;
	}

	// If authenticated, render children
	if (isAuthenticated) {
		return <>{children}</>;
	}

	// Show lock screen
	return (
		<View style={{ flex: 1, backgroundColor: theme.background }}>
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
							<Stop offset="0.4" stopColor={theme.background} stopOpacity={0} />
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
						colorScheme === "dark"
							? require(`../assets/images/grain-dark.png`)
							: require(`../assets/images/grain.png`)
					}
					style={{
						flex: 1,
						opacity: 0.2,
						backgroundColor: theme.background,
					}}
				/>
			</View>

			<SafeAreaView style={{ flex: 1 }}>
				<View
					style={{
						flex: 1,
						justifyContent: "center",
						alignItems: "center",
						paddingHorizontal: 32,
					}}
				>
					<View
						style={{
							alignItems: "center",
							marginBottom: 48,
						}}
					>
						<View
							style={{
								width: 80,
								height: 80,
								borderRadius: 40,
								backgroundColor: theme.secondary,
								justifyContent: "center",
								alignItems: "center",
								marginBottom: 24,
							}}
						>
							<Icon
								name={Lock}
								size={36}
								lightColor={theme.text}
								darkColor={theme.text}
							/>
						</View>
						<Text
							style={{
								fontSize: 24,
								fontWeight: "600",
								marginBottom: 8,
								textAlign: "center",
							}}
						>
							Whisper is Locked
						</Text>
						<Text
							style={{
								fontSize: 15,
								opacity: 0.6,
								textAlign: "center",
								lineHeight: 22,
							}}
						>
							Use Face ID, Touch ID, or your device passcode to unlock
						</Text>
					</View>

					{authError && (
						<Text
							style={{
								fontSize: 14,
								color: theme.red,
								textAlign: "center",
								marginBottom: 16,
							}}
						>
							{authError}
						</Text>
					)}

					<Button
						onPress={handleAuthenticate}
						loading={isAuthenticating}
						disabled={isAuthenticating}
						style={{ minWidth: 160 }}
					>
						Unlock
					</Button>
				</View>
			</SafeAreaView>
		</View>
	);
}
