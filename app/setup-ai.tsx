import { GradientBackground } from "@/components/gradient-background";
import { createLogger } from "@/src/logger";
import { ModelUpdateNotification } from "@/components/model-update-notification";
import { ProviderSetupCard } from "@/components/ProviderSetupCard";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { completeOnboarding } from "@/src/actions/settings";
import {
	checkForModelUpdates,
	getStoredModelCard,
	type ModelUpdateInfo,
} from "@/src/ai-providers/whisper-ai/model-config";
import { mainStore } from "@/src/stores/main/main-store";
import { Colors } from "@/theme/colors";
import { useNavigationState } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { BadgeInfo, ChevronDown, ChevronLeft } from "lucide-react-native";
import { useRef, useState } from "react";
import { Animated, Pressable, useColorScheme } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Store } from "tinybase";
import { useCell, useValue } from "tinybase/ui-react";

const logger = createLogger("SetupAI");

export default function SetupAI() {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const router = useRouter();
	const navigationIndex = useNavigationState((state) => state.index);

	const onboardedAt = useValue("onboardedAt");
	const isOnboarding = !onboardedAt;

	const { providers, enableProvider, disableProvider } = useAIProvider();

	// Whisper AI model update check
	const configVersion = useCell("aiProviders", "whisper-ai", "configVersion") as
		| string
		| undefined;
	const downloadedAt = useCell("aiProviders", "whisper-ai", "downloadedAt") as
		| string
		| undefined;
	const modelCard = getStoredModelCard(mainStore as unknown as Store);

	const [advancedOpen, setAdvancedOpen] = useState(false);
	const advancedAnim = useRef(new Animated.Value(0)).current;

	const toggleAdvanced = () => {
		const toValue = advancedOpen ? 0 : 1;
		setAdvancedOpen(!advancedOpen);
		Animated.timing(advancedAnim, {
			toValue,
			duration: 200,
			useNativeDriver: false,
		}).start();
	};

	const advancedRotation = advancedAnim.interpolate({
		inputRange: [0, 1],
		outputRange: ["0deg", "180deg"],
	});

	const [checkingForUpdates, setCheckingForUpdates] = useState(false);
	const [showUpToDate, setShowUpToDate] = useState(false);
	const [updateInfo, setUpdateInfo] = useState<ModelUpdateInfo | null>(null);
	const [showUpdateNotification, setShowUpdateNotification] = useState(false);

	// Check if at least one provider is ready
	const hasReadyProvider = providers.some((p) => {
		const status = mainStore.getCell("aiProviders", p.id, "status") as
			| string
			| undefined;
		return status === "ready";
	});

	const handleConfigure = (id: string) => {
		router.push(`/provider-setup/${id}`);
	};

	const handleToggleEnabled = (id: string, enabled: boolean) => {
		if (enabled) {
			enableProvider(id);
			router.push(`/provider-setup/${id}`);
		} else {
			disableProvider(id);
		}
	};

	const handleContinue = () => {
		if (isOnboarding) {
			completeOnboarding();
			router.replace("/dashboard");
			return;
		}

		if (navigationIndex > 0) {
			router.back();
			return;
		}

		router.replace("/dashboard");
	};

	const handleCheckForUpdates = async () => {
		if (!downloadedAt || !configVersion) return;

		setCheckingForUpdates(true);
		try {
			const result = await checkForModelUpdates(mainStore as unknown as Store);
			if (result.hasUpdate) {
				setUpdateInfo(result);
				setShowUpdateNotification(true);
			} else {
				setShowUpToDate(true);
				setTimeout(() => setShowUpToDate(false), 2000);
			}
		} catch (error) {
			logger.error("Failed to check for updates", { error });
		} finally {
			setCheckingForUpdates(false);
		}
	};

	return (
		<View style={{ flex: 1 }}>
			<GradientBackground variant="simple" />
			<SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
				{/* Header */}
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						padding: 16,
						position: "relative",
					}}
				>
					{!isOnboarding && navigationIndex > 0 && (
						<Button onPress={() => router.back()} variant="ghost" size="icon">
							<ChevronLeft color={theme.textMuted} strokeWidth={2} size={24} />
						</Button>
					)}
				</View>

				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={{
						padding: 24,
						paddingTop: 32,
						paddingBottom: 256,
						paddingHorizontal: 36,
					}}
				>
					<Text
						style={{
							fontSize: 32,
							fontWeight: "600",
							marginBottom: 8,
							textAlign: "center",
						}}
						pointerEvents="none"
					>
						Setup AI
					</Text>
					<Text
						style={{
							fontSize: 14,
							marginBottom: 56,
							lineHeight: 20,
							textAlign: "center",
						}}
					>
						Enable and configure your AI
					</Text>

					{/* Whisper AI provider - always visible */}
					{providers
						.filter((p) => p.id === "whisper-ai")
						.map((p) => (
							<View key={p.id}>
								<ProviderSetupCard
									provider={p}
									onConfigure={handleConfigure}
									onToggleEnabled={handleToggleEnabled}
								/>
								{modelCard && configVersion && downloadedAt && (
									<View style={{ marginTop: 4, marginBottom: 16 }}>
										<Text
											style={{
												fontSize: 12,
												opacity: 0.6,
												marginBottom: 12,
												lineHeight: 18,
												textAlign: "center",
											}}
										>
											{modelCard.name} • v{configVersion} •{" "}
											{modelCard.sizeGB.toFixed(1)} GB
										</Text>
										<Button
											variant="outline"
											size="sm"
											onPress={handleCheckForUpdates}
											disabled={checkingForUpdates || showUpToDate}
										>
											{checkingForUpdates
												? "Checking..."
												: showUpToDate
													? "Up to date!"
													: "Check for Updates"}
										</Button>
									</View>
								)}
							</View>
						))}

					{/* Non-whisper local providers - visible when not onboarding */}
					{!isOnboarding &&
						providers
							.filter((p) => p.type === "local" && p.id !== "whisper-ai")
							.map((p) => (
								<ProviderSetupCard
									key={p.id}
									provider={p}
									onConfigure={handleConfigure}
									onToggleEnabled={handleToggleEnabled}
								/>
							))}

					{isOnboarding && (
						<Pressable
							onPress={toggleAdvanced}
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "center",
								marginTop: 32,
								marginBottom: 32,
								gap: 8,
							}}
						>
							<Text
								style={{
									fontSize: 14,
									fontWeight: "600",
									color: theme.text,
								}}
							>
								More Options
							</Text>
							<Animated.View
								style={{ transform: [{ rotate: advancedRotation }] }}
							>
								<ChevronDown size={18} color={theme.text} strokeWidth={2} />
							</Animated.View>
						</Pressable>
					)}

					{(!isOnboarding || advancedOpen) && (
						<>
							{/* Other local providers - only in advanced during onboarding */}
							{isOnboarding &&
								providers.filter(
									(p) => p.type === "local" && p.id !== "whisper-ai",
								).length > 0 && (
									<>
										<Text
											style={{
												fontSize: 24,
												marginTop: 8,
												marginBottom: 8,
												lineHeight: 24,
												textAlign: "center",
												fontWeight: "600",
											}}
										>
											Local Providers
										</Text>
										<Text
											style={{
												fontSize: 14,
												lineHeight: 20,
												textAlign: "center",
												marginBottom: 24,
												color: theme.text,
												opacity: 0.8,
											}}
										>
											Other on-device AI providers.
										</Text>
										{providers
											.filter(
												(p) => p.type === "local" && p.id !== "whisper-ai",
											)
											.map((p) => (
												<ProviderSetupCard
													key={p.id}
													provider={p}
													onConfigure={handleConfigure}
													onToggleEnabled={handleToggleEnabled}
												/>
											))}
									</>
								)}

							<Text
								style={{
									fontSize: 24,
									marginTop: isOnboarding ? 24 : 40,
									marginBottom: 8,
									lineHeight: 24,
									textAlign: "center",
									fontWeight: "600",
								}}
							>
								Cloud Providers
							</Text>
							<Text
								style={{
									fontSize: 14,
									lineHeight: 20,
									textAlign: "center",
									marginBottom: 8,
									color: theme.text,
									opacity: 0.8,
									maxWidth: 220,
									margin: "auto",
								}}
							>
								You can use other providers in Whisper. Internet required.
							</Text>
							<View
								style={{
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
									paddingTop: 8,
									paddingBottom: 32,
								}}
							>
								<View
									style={{
										display: "flex",
										justifyContent: "center",
										alignItems: "center",
										flexDirection: "row",
										gap: 6,

										opacity: 0.6,
										backgroundColor: theme.background,
										width: "auto",
										paddingHorizontal: 12,
										paddingVertical: 4,
										borderRadius: 12,
									}}
								>
									<BadgeInfo
										size={16}
										color={"#fff"}
										fill={theme.destructive}
									/>
									<Text
										style={{
											fontSize: 12,
											lineHeight: 16,
											textAlign: "center",
											color: theme.destructive,
										}}
									>
										Privacy not guaranteed
									</Text>
								</View>
							</View>

							{providers
								.filter((p) => p.type === "cloud" && !p.capabilities.userApiKey)
								.map((p) => (
									<ProviderSetupCard
										key={p.id}
										provider={p}
										onConfigure={handleConfigure}
										onToggleEnabled={handleToggleEnabled}
									/>
								))}

							{providers
								.filter((p) => p.capabilities.userApiKey)
								.map((p) => (
									<ProviderSetupCard
										key={p.id}
										provider={p}
										onConfigure={handleConfigure}
										onToggleEnabled={handleToggleEnabled}
									/>
								))}
						</>
					)}
				</ScrollView>

				{/* Continue button */}
				<View
					style={{
						padding: 24,
						paddingBottom: 40,
						position: "absolute",
						bottom: 0,
						width: "100%",
					}}
				>
					<Button
						onPress={handleContinue}
						disabled={!hasReadyProvider}
						style={{
							width: "100%",
							shadowColor: "black",
							shadowOpacity: 0.65,
							shadowOffset: { width: 0, height: 2 },
							shadowRadius: 20,
							elevation: 12,
						}}
						size="lg"
					>
						{isOnboarding ? "Get Started" : "Done"}
					</Button>
					{!hasReadyProvider && (
						<Text
							style={{
								fontSize: 12,
								opacity: 0.5,
								textAlign: "center",
								marginTop: 8,
							}}
						>
							Configure at least one provider to continue
						</Text>
					)}
				</View>

				{/* Model Update Notification */}
				{updateInfo && (
					<ModelUpdateNotification
						isVisible={showUpdateNotification}
						onClose={() => setShowUpdateNotification(false)}
						currentCard={updateInfo.currentCard}
						newCard={updateInfo.newCard}
						currentVersion={updateInfo.currentVersion || "unknown"}
						newVersion={updateInfo.newVersion}
						requiresDownload={updateInfo.requiresDownload}
					/>
				)}
			</SafeAreaView>
		</View>
	);
}
