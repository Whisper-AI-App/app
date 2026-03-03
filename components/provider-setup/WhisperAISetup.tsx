import { FlappyBird } from "@/components/flappy-bird";
import { GradientBackground } from "@/components/gradient-background";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { useColor } from "@/hooks/useColor";
import { DEFAULT_AI_CHAT_MODEL } from "@/src/ai-providers/whisper-ai/constants";
import {
	pauseDownload,
	startDownload,
} from "@/src/ai-providers/whisper-ai/download";
import { fetchLatestRecommendedModel } from "@/src/ai-providers/whisper-ai/model-config";
import { mainStore } from "@/src/stores/main/main-store";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCell, useValue } from "tinybase/ui-react";
import type { WhisperLLMCard } from "whisper-llm-cards";

export function WhisperAISetup() {
	const router = useRouter();
	const backgroundColor = useColor("background");
	const primaryForegroundColor = useColor("primaryForeground");
	const { setActiveProvider } = useAIProvider();

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
	const [initialDownloadedAt] = useState<string | undefined>(
		() =>
			mainStore.getCell("aiProviders", "whisper-ai", "downloadedAt") as
				| string
				| undefined,
	);

	// Subscribe to download state from aiProviders table
	const filename = useCell("aiProviders", "whisper-ai", "filename") as
		| string
		| undefined;
	const downloadedAt = useCell("aiProviders", "whisper-ai", "downloadedAt") as
		| string
		| undefined;
	const downloadError = useCell("aiProviders", "whisper-ai", "downloadError") as
		| string
		| undefined;
	const progressSizeGB = useCell(
		"aiProviders",
		"whisper-ai",
		"progressSizeGB",
	) as number | undefined;
	const isPaused = useCell("aiProviders", "whisper-ai", "isPaused") as
		| boolean
		| undefined;
	const onboardedAt = useValue("onboardedAt");
	const fileRemoved = useCell("aiProviders", "whisper-ai", "fileRemoved") as
		| boolean
		| undefined;

	// Fetch latest recommended model on mount
	useEffect(() => {
		const fetchModel = async () => {
			try {
				const [result] = await Promise.all([
					fetchLatestRecommendedModel(),
					new Promise((resolve) => setTimeout(resolve, 2000)),
				]);
				setModelCard(result.recommendedCard);
				setModelCardId(result.cardId);
				setConfigVersion(result.config.version);
			} catch (err) {
				console.error("[ProviderSetup] Failed to fetch latest model:", err);
			} finally {
				setIsFetchingModel(false);
			}
		};
		fetchModel();
	}, []);

	// When download completes, navigate back
	useEffect(() => {
		if (downloadedAt && downloadedAt !== initialDownloadedAt) {
			setIsDownloading(false);

			if (fileRemoved) {
				mainStore.setCell("aiProviders", "whisper-ai", "fileRemoved", false);
			}

			setActiveProvider("whisper-ai");
			router.back();
		}
	}, [
		downloadedAt,
		initialDownloadedAt,
		fileRemoved,
		router,
		setActiveProvider,
	]);

	useEffect(() => {
		if (downloadError) {
			setError(downloadError);
			setIsDownloading(false);
		}
	}, [downloadError]);

	useEffect(() => {
		if (isPaused === false && filename && !downloadedAt) {
			setIsDownloading(true);
		} else if (isPaused === true) {
			setIsDownloading(false);
		}
	}, [isPaused, filename, downloadedAt]);

	const handleStartDownload = async (restart: boolean = false) => {
		setIsDownloading(true);
		setError(undefined);

		try {
			await startDownload(
				mainStore as any,
				modelCard,
				modelCardId,
				configVersion,
				restart,
			);
		} catch (err) {
			console.error(err);
			setError("Failed to download, try again");
			setIsDownloading(false);
		}
	};

	const handlePauseDownload = async () => {
		try {
			await pauseDownload(mainStore as any);
			setIsDownloading(false);
		} catch (err) {
			console.error(err);
			setError("Failed to pause download");
		}
	};

	const hasPartialDownload =
		filename && (!downloadedAt || downloadedAt === initialDownloadedAt);
	const totalSizeGB = modelCard.sizeGB;
	const progressValue =
		totalSizeGB && progressSizeGB ? progressSizeGB / totalSizeGB : 0;

	return (
		<View style={{ flex: 1 }}>
			<GradientBackground variant="simple" />

			<SafeAreaView style={{ flex: 1 }}>
				<View
					style={{
						width: "100%",
						justifyContent: "space-between",
						alignItems: "center",
						flexDirection: "row",
						padding: 16,
					}}
				>
					{!isDownloading && (
						<Button onPress={() => router.back()} variant="ghost" size="icon">
							<ChevronLeft
								color="rgba(125,125,125,0.7)"
								strokeWidth={2}
								size={24}
							/>
						</Button>
					)}

					<View style={{ marginLeft: "auto" }}>
						<ModeToggle />
					</View>
				</View>

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
							style={{
								textAlign: "center",
								lineHeight: 24,
								opacity: 0.8,
								maxWidth: 256,
								margin: "auto",
							}}
						>
							{fileRemoved && onboardedAt
								? "AI model needs to be downloaded again, likely removed by your phone."
								: hasPartialDownload
									? isPaused
										? "Resume or restart your paused download"
										: "Download in progress, please don't leave this screen"
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
					<View style={{ width: "100%", gap: 16, paddingVertical: 24 }}>
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

					{isDownloading && (
						<Button onPress={() => setShowGame(true)} style={{ width: "100%" }}>
							Play a game while you wait
						</Button>
					)}

					{hasPartialDownload ? (
						<>
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

							{!isDownloading && (
								<Button
									variant="outline"
									onPress={() => handleStartDownload(true)}
									disabled={isDownloading}
									style={{ width: "100%" }}
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
