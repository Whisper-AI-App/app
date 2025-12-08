import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
	DEFAULT_AI_CHAT_MODEL,
	fetchLatestRecommendedModel,
	pauseDownload,
	startOrResumeDownloadOfAIChatModel,
} from "@/src/actions/ai-chat-model";
import { completeOnboarding } from "@/src/actions/settings";
import { ImageBackground } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Defs, RadialGradient, Rect, Stop, Svg } from "react-native-svg";
import { useValue } from "tinybase/ui-react";
import type { WhisperLLMCard } from "whisper-llm-cards";

export default function Download() {
	const router = useRouter();
	const scheme = useColorScheme();
	const backgroundColor = useColor("background");
	const primaryForegroundColor = useColor("primaryForeground");

	const [isDownloading, setIsDownloading] = useState(false);
	const [error, setError] = useState<string | undefined>();
	const [isFetchingModel, setIsFetchingModel] = useState(true);
	const [modelCard, setModelCard] = useState<WhisperLLMCard>(
		DEFAULT_AI_CHAT_MODEL,
	);
	const [modelCardId, setModelCardId] = useState<string>(
		"llama-3.2-1b-instruct-q4_0",
	);
	const [configVersion, setConfigVersion] = useState<string>("1.0.0");

	// Subscribe to download state from tinybase
	// Use filename instead of full path (path changes between app updates)
	const filename = useValue("ai_chat_model_filename") as string | undefined;
	const downloadedAt = useValue("ai_chat_model_downloadedAt") as
		| string
		| undefined;
	const downloadError = useValue("ai_chat_model_downloadError") as
		| string
		| undefined;
	const progressSizeGB = useValue("ai_chat_model_progressSizeGB") as
		| number
		| undefined;
	const isPaused = useValue("ai_chat_model_isPaused") as boolean | undefined;
	const onboardedAt = useValue("onboardedAt");
	const fileRemoved = useValue("ai_chat_model_fileRemoved") as
		| boolean
		| undefined;

	// Fetch latest recommended model on mount
	useEffect(() => {
		const fetchModel = async () => {
			try {
				// Race between actual fetch and minimum 400ms delay
				const [result] = await Promise.all([
					fetchLatestRecommendedModel(),
					new Promise((resolve) => setTimeout(resolve, 2000)),
				]);
				setModelCard(result.recommendedCard);
				setModelCardId(result.cardId);
				setConfigVersion(result.config.version);
			} catch (err) {
				console.error("[Download] Failed to fetch latest model:", err);
				// Already using DEFAULT_AI_CHAT_MODEL as fallback
			} finally {
				setIsFetchingModel(false);
			}
		};

		fetchModel();
	}, []);

	// When download completes, mark onboarding as complete and navigate to dashboard
	useEffect(() => {
		if (downloadedAt) {
			setIsDownloading(false);

			// Clear the file removed flag since we have a new download
			if (fileRemoved) {
				const { store } = require("@/src/store");
				store.delValue("ai_chat_model_fileRemoved");
			}

			// Complete onboarding if first time
			if (!onboardedAt) {
				completeOnboarding();
			}
		}
	}, [downloadedAt, onboardedAt, fileRemoved, router]);

	// Update error state
	useEffect(() => {
		if (downloadError) {
			setError(downloadError);
			setIsDownloading(false);
		}
	}, [downloadError]);

	// Track download state from isPaused
	useEffect(() => {
		if (isPaused === false && filename && !downloadedAt) {
			// Download is actively running
			setIsDownloading(true);
		} else if (isPaused === true) {
			// Download is paused
			setIsDownloading(false);
		}
	}, [isPaused, filename, downloadedAt]);

	const handleStartDownload = async (restart: boolean = false) => {
		setIsDownloading(true);
		setError(undefined);

		try {
			await startOrResumeDownloadOfAIChatModel(
				modelCard,
				modelCardId,
				configVersion,
				restart,
			);
			// Download will continue in background, progress tracked via tinybase

			router.replace("/dashboard");
		} catch (err) {
			console.error(err);
			setError("Failed to download, try again");
			setIsDownloading(false);
		}
	};

	const handlePauseDownload = async () => {
		try {
			await pauseDownload();
			setIsDownloading(false);
		} catch (err) {
			console.error(err);
			setError("Failed to pause download");
		}
	};

	const hasPartialDownload = filename && !downloadedAt;
	const totalSizeGB = modelCard.sizeGB;
	const progressValue =
		totalSizeGB && progressSizeGB ? progressSizeGB / totalSizeGB : 0;

	return (
		<View style={{ flex: 1 }}>
			{/* Background gradient - same as onboarding */}
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
				{/* Mode toggle in top right */}
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

				{/* Main content - centered like onboarding */}
				<View
					style={{
						flex: 1,
						justifyContent: "center",
						alignItems: "center",
						paddingHorizontal: 24,
						maxWidth: 400,
						alignSelf: "center",
						width: "100%",
					}}
				>
					<View style={{ alignItems: "center", marginBottom: 40 }}>
						<Text
							variant="title"
							style={{ textAlign: "center", marginBottom: 16, fontSize: 32 }}
						>
							Download AI Chat
						</Text>
						<Text
							variant="body"
							style={{ textAlign: "center", lineHeight: 24, opacity: 0.8 }}
						>
							{fileRemoved && onboardedAt
								? "AI model needs to be downloaded again, likely removed by your phone."
								: hasPartialDownload
									? isPaused
										? "Resume or restart your paused download"
										: "Download in progress"
									: "Get started by downloading the AI chat. This will enable private, on-device conversations."}
						</Text>
						{!isFetchingModel && !hasPartialDownload && (
							<Text
								variant="body"
								style={{
									textAlign: "center",
									marginTop: 16,
									fontSize: 14,
									opacity: 0.6,
								}}
							>
								{modelCard.name} ({modelCard.sizeGB.toFixed(1)} GB)
							</Text>
						)}
					</View>
				</View>

				{/* Action buttons at bottom */}
				<View
					style={{
						width: "100%",
						paddingHorizontal: 24,
						paddingBottom: 40,
						gap: 12,
						minHeight: 300,
						display: "flex",
						justifyContent: "flex-end",
					}}
				>
					{/* Download info */}
					<View style={{ width: "100%", gap: 16, paddingVertical: 24 }}>
						{/* Progress indicator */}
						{hasPartialDownload && (
							<View style={{ gap: 8, paddingHorizontal: 24 }}>
								<View
									style={{
										flexDirection: "row",
										justifyContent: "space-between",
										alignItems: "center",
									}}
								>
									<Text style={{ fontSize: 14 }}>
										{isDownloading ? "Downloading..." : "Paused"}
									</Text>
									<Text style={{ fontSize: 14, fontWeight: "600" }}>
										{progressSizeGB?.toFixed(2) || 0} GB /{" "}
										{totalSizeGB?.toFixed(2) || 0} GB (
										{Math.round(progressValue * 100)}%)
									</Text>
								</View>
								<Progress value={progressValue} height={12} />
							</View>
						)}

						{/* Error message */}
						{error && (
							<View
								style={{
									padding: 12,
									backgroundColor: "rgba(239, 68, 68, 0.1)",
									borderRadius: 8,
									borderWidth: 1,
									borderColor: "rgba(239, 68, 68, 0.3)",
								}}
							>
								<Text style={{ color: "#ef4444", fontSize: 14 }}>{error}</Text>
							</View>
						)}

						{/* Info text */}
						<Text
							style={{
								fontSize: 12,

								textAlign: "center",
								maxWidth: 220,
								marginHorizontal: "auto",
							}}
						>
							The download may take a while, you can pause and resume at any
							time.
						</Text>
					</View>

					{hasPartialDownload ? (
						<>
							{/* Resume/Pause button */}
							{isDownloading ? (
								<Button
									onPress={handlePauseDownload}
									variant="outline"
									style={{ width: "100%" }}
								>
									Pause Download
								</Button>
							) : (
								<Button
									onPress={() => handleStartDownload(false)}
									style={{ width: "100%" }}
								>
									{`Resume Download (${Number.parseFloat(
										(
											((progressSizeGB ?? 1) / (totalSizeGB ?? 1)) *
											100
										).toString(),
									).toFixed(1)}%)`}
								</Button>
							)}

							{/* Restart button */}
							{!isDownloading && (
								<Button
									variant="outline"
									onPress={() => handleStartDownload(true)}
									disabled={isDownloading}
									style={{
										width: "100%",
									}}
								>
									Restart Download
								</Button>
							)}
						</>
					) : (
						<Button
							onPress={() => handleStartDownload(false)}
							disabled={isDownloading || isFetchingModel}
							style={{ width: "100%" }}
						>
							{isFetchingModel ? (
								<View
									style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
								>
									<ActivityIndicator color={primaryForegroundColor} />
									<Text style={{ color: primaryForegroundColor }}>
										Checking for updates...
									</Text>
								</View>
							) : isDownloading ? (
								<ActivityIndicator color="white" />
							) : (
								"Download Model"
							)}
						</Button>
					)}
				</View>
			</SafeAreaView>
		</View>
	);
}
