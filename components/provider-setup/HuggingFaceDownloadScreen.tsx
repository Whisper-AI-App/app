import { FlappyBird } from "@/components/flappy-bird";
import { GradientBackground } from "@/components/gradient-background";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Progress } from "@/components/ui/progress";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { useColor } from "@/hooks/useColor";
import { mainStore } from "@/src/stores/main/main-store";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Store } from "tinybase";
import { useCell } from "tinybase/ui-react";

interface HuggingFaceDownloadScreenProps {
	modelId: string;
}

export function HuggingFaceDownloadScreen({
	modelId,
}: HuggingFaceDownloadScreenProps) {
	const router = useRouter();
	const backgroundColor = useColor("background");
	const { setActiveProvider } = useAIProvider();
	const store = mainStore as unknown as Store;

	const [isDownloading, setIsDownloading] = useState(false);
	const [error, setError] = useState<string | undefined>();
	const [showGame, setShowGame] = useState(false);
	const hasNavigatedRef = useRef(false);
	const hasStartedRef = useRef(false);

	// Subscribe to model metadata
	const displayName = useCell("hfModels", modelId, "displayName") as
		| string
		| undefined;
	const fileSizeBytes = useCell("hfModels", modelId, "fileSizeBytes") as
		| number
		| undefined;
	const downloadedAt = useCell("hfModels", modelId, "downloadedAt") as
		| string
		| undefined;

	// Subscribe to provider download state
	const providerStatus = useCell("aiProviders", "huggingface", "status") as
		| string
		| undefined;
	const progressSizeGB = useCell(
		"aiProviders",
		"huggingface",
		"progressSizeGB",
	) as number | undefined;
	const totalSizeGB = useCell("aiProviders", "huggingface", "totalSizeGB") as
		| number
		| undefined;
	const isPaused = useCell("aiProviders", "huggingface", "isPaused") as
		| boolean
		| undefined;
	const downloadError = useCell(
		"aiProviders",
		"huggingface",
		"downloadError",
	) as string | undefined;

	const fileSizeGB =
		fileSizeBytes != null
			? (fileSizeBytes / (1024 * 1024 * 1024)).toFixed(1)
			: null;

	const downloading = providerStatus === "downloading" && !isPaused;
	const progressValue =
		totalSizeGB && progressSizeGB ? progressSizeGB / totalSizeGB : 0;
	const hasPartialDownload = providerStatus === "downloading" || isPaused;

	// Auto-start download on mount
	useEffect(() => {
		if (hasStartedRef.current) return;
		hasStartedRef.current = true;

		const doStart = async () => {
			setIsDownloading(true);
			setError(undefined);
			try {
				const { createHuggingFaceProvider } = await import(
					"@/src/ai-providers/huggingface/provider"
				);
				const provider = createHuggingFaceProvider(store);
				await provider.startDownload?.();
			} catch (err) {
				setError(err instanceof Error ? err.message : "Download failed");
				setIsDownloading(false);
			}
		};
		doStart();
	}, [store]);

	// Sync local isDownloading state with store
	useEffect(() => {
		if (isPaused === false && providerStatus === "downloading") {
			setIsDownloading(true);
		} else if (isPaused === true) {
			setIsDownloading(false);
		}
	}, [isPaused, providerStatus]);

	// Show download errors
	useEffect(() => {
		if (downloadError) {
			setError(downloadError);
			setIsDownloading(false);
		}
	}, [downloadError]);

	// Auto-navigate when download completes
	useEffect(() => {
		if (hasNavigatedRef.current) return;
		if (downloadedAt) {
			hasNavigatedRef.current = true;
			setIsDownloading(false);

			setActiveProvider("huggingface")
				.then(() => {
					if (router.canGoBack()) {
						router.back();
					} else {
						router.replace("/dashboard");
					}
				})
				.catch(() => {
					router.replace("/dashboard");
				});
		}
	}, [downloadedAt, router, setActiveProvider]);

	const handlePause = async () => {
		try {
			const { pauseDownload } = await import(
				"@/src/ai-providers/huggingface/download"
			);
			await pauseDownload(store);
			setIsDownloading(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to pause");
		}
	};

	const handleResume = async () => {
		setIsDownloading(true);
		setError(undefined);
		try {
			const { resumeDownload } = await import(
				"@/src/ai-providers/huggingface/download"
			);
			await resumeDownload(store);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to resume");
			setIsDownloading(false);
		}
	};

	const handleRestart = async () => {
		setIsDownloading(true);
		setError(undefined);
		try {
			const { startDownload } = await import(
				"@/src/ai-providers/huggingface/download"
			);
			await startDownload(store, true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Download failed");
			setIsDownloading(false);
		}
	};

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
					{/* Hide back button while downloading */}
					<View style={{ width: 40 }} />
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
							Download AI Model
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
							{hasPartialDownload
								? isPaused
									? "Resume or restart your paused download"
									: "Download in progress, please don't leave this screen"
								: "Get started by downloading your selected AI model for private, on-device conversations."}
						</Text>
						{displayName && fileSizeGB && (
							<Text
								variant="body"
								style={{
									textAlign: "center",
									marginTop: 16,
									fontSize: 14,
									opacity: 0.6,
								}}
							>
								{displayName} ({fileSizeGB} GB)
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
										{downloading ? "Downloading..." : "Paused"}
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

					{downloading && (
						<Button
							onPress={() => setShowGame(true)}
							style={{ width: "100%" }}
						>
							Play a game while you wait
						</Button>
					)}

					{hasPartialDownload ? (
						<>
							{downloading ? (
								<Button
									onPress={handlePause}
									variant="outline"
									style={{ width: "100%" }}
								>
									Pause Download
								</Button>
							) : (
								<Button onPress={handleResume} style={{ width: "100%" }}>
									{`Resume Download (${Number.parseFloat(
										(progressValue * 100).toString(),
									).toFixed(1)}%)`}
								</Button>
							)}

							{!downloading && (
								<Button
									variant="outline"
									onPress={handleRestart}
									disabled={isDownloading}
									style={{ width: "100%" }}
								>
									Restart Download
								</Button>
							)}
						</>
					) : null}
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
