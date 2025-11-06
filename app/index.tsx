import { onboardingSteps } from "@/components/flows/onboarding-steps";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Onboarding } from "@/components/ui/onboarding";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { useColorScheme } from "@/hooks/useColorScheme";
import { ImageBackground } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Defs, RadialGradient, Rect, Stop, Svg } from "react-native-svg";
import { useValue } from "tinybase/ui-react";

export default function Index() {
	const router = useRouter();
	const scheme = useColorScheme();
	const backgroundColor = useColor("background");
	const onboardedAt = useValue("onboardedAt");
	const downloadedAt = useValue("ai_chat_model_downloadedAt");

	useEffect(() => {
		if (onboardedAt) {
			// If onboarded but model not downloaded, go to download page
			if (!downloadedAt) {
				router.replace("/download");
			} else {
				router.replace("/dashboard");
			}
		}
	}, [onboardedAt, downloadedAt]);

	return (
		<View style={{ flex: 1 }}>
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
					viewBox={`0 0 1 ${Dimensions.get("window").height / Dimensions.get("window").width}`}
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
								stopColor={"#ff9e37ff"}
								stopOpacity={scheme !== "dark" ? 0.9 : 0.95}
							/>
							<Stop
								offset="0.275"
								stopColor={"#ff5b91ff"}
								stopOpacity={scheme !== "dark" ? 0.9 : 0.9}
							/>
							<Stop
								offset="0.3"
								stopColor={"#ff95ffff"}
								stopOpacity={scheme !== "dark" ? 0.8 : 0.6}
							/>
							<Stop
								offset="0.325"
								stopColor={"#69b7ffff"}
								stopOpacity={scheme !== "dark" ? 0.7 : 0.6}
							/>
							<Stop
								offset="0.65"
								stopColor={"#0017c2ff"}
								stopOpacity={scheme !== "dark" ? 0 : 0}
							/>
							<Stop offset="0.85" stopColor={"transparent"} stopOpacity={0} />
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
							? require(`../assets/images/grain-dark.png`)
							: require(`../assets/images/grain.png`)
					}
					style={{
						flex: 1,
						opacity: scheme === "dark" ? 0.3 : 0.25,
						backgroundColor: backgroundColor,
					}}
				/>
			</View>
			<SafeAreaView style={{ flex: 1 }}>
				<View
					style={{
						width: "100%",
						justifyContent: "flex-end",
						alignItems: "flex-end",
						flexDirection: "row",
						padding: 16,
					}}
				>
					<ModeToggle />
				</View>

				<Onboarding
					steps={onboardingSteps}
					onComplete={() => {
						router.replace("/download");
					}}
					showSkip={false}
				/>

				{/* <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
				<Text style={{ fontFamily: "Lexend_600SemiBold", fontSize: 40 }}>
					whisper
				</Text>
			</View> */}
			</SafeAreaView>
		</View>
	);
}
