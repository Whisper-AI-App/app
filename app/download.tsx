import { FlappyBird } from "@/components/flappy-bird";
import { GradientBackground } from "@/components/gradient-background";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { DEFAULT_AI_CHAT_MODEL } from "@/src/actions/ai/constants";
import {
	pauseDownload,
	startOrResumeDownloadOfAIChatModel,
} from "@/src/actions/ai/download-control";
import { fetchLatestRecommendedModel } from "@/src/actions/ai/model-config";
import { completeOnboarding } from "@/src/actions/settings";
import { mainStore } from "@/src/stores/main/main-store";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useValue } from "tinybase/ui-react";
import type { WhisperLLMCard } from "whisper-llm-cards";

export default function Download() {
	const router = useRouter();
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
	const [showGame, setShowGame] = useState(false);
	// Track the downloadedAt value when the screen mounted to detect new completions
	const [initialDownloadedAt] = useState<string | undefined>(() =>
		mainStore.getValue("ai_chat_model_downloadedAt") as string | undefined,
	);

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
		// Only act on NEW download completions, not pre-existing ones from before this screen mounted
		// This prevents immediate navigation when arriving from update flow with existing downloadedAt
		if (downloadedAt && downloadedAt !== initialDownloadedAt) {
			setIsDownloading(false);

			// Clear the file removed flag since we have a new download
			if (fileRemoved) {
				mainStore.delValue("ai_chat_model_fileRemoved");
			}

			// Complete onboarding if first time
			if (!onboardedAt) {
				completeOnboarding();
			}

			// Navigate to dashboard now that download is complete
			router.replace("/dashboard");
		}
	}, [downloadedAt, initialDownloadedAt, onboardedAt, fileRemoved, router]);

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
			// Navigation happens when downloadedAt is set (see useEffect above)
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

	// Check if there's a download in progress or paused
	// For update flow: downloadedAt exists but equals initialDownloadedAt (no new completion yet)
	// For fresh download: no downloadedAt at all
	const hasPartialDownload =
		filename && (!downloadedAt || downloadedAt === initialDownloadedAt);
	const totalSizeGB = modelCard.sizeGB;
	const progressValue =
		totalSizeGB && progressSizeGB ? progressSizeGB / totalSizeGB : 0;

	return (
		<View style={{ flex: 1 }}>
			<GradientBackground variant="simple" />

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

					{/* Game option while downloading */}
					{isDownloading && (
						<Button
							onPress={() => setShowGame(true)}
							style={{ width: "100%" }}
						>
							Play a game while you wait
						</Button>
					)}

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

			{/* Flappy Bird Game Full Screen Modal */}
			<Modal
				visible={showGame}
				animationType="slide"
				presentationStyle="pageSheet"
				onRequestClose={() => setShowGame(false)}
			>
				<View style={{ flex: 1, backgroundColor }}>
					<FlappyBird onClose={() => setShowGame(false)} />
				</View>
			</Modal>
		</View>
	);
}
