import { Logo } from "@/components/logo";
import { ModelUpdateNotification } from "@/components/model-update-notification";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIChat } from "@/contexts/AIChatContext";
import {
	checkForModelUpdates,
	getStoredModelCard,
} from "@/src/actions/ai/model-config";
import type { ModelUpdateInfo } from "@/src/actions/ai/types";
import { clearConversations, resetEverything } from "@/src/actions/reset";
import {
	authenticate,
	checkLocalAuthAvailable,
	setLocalAuth,
} from "@/src/actions/settings";
import { getDeviceCapabilities } from "@/src/utils/device-capabilities";
import { Colors } from "@/theme/colors";
import { BORDER_RADIUS } from "@/theme/globals";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { Share, Switch, TouchableOpacity, useColorScheme } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useValue } from "tinybase/ui-react";

// Helper component for table-style info rows
const InfoRow = ({
	label,
	value,
	isLast = false,
}: {
	label: string;
	value: string | number | undefined;
	isLast?: boolean;
}) => (
	<View
		style={{
			flexDirection: "row",
			justifyContent: "space-between",
			alignItems: "center",
			paddingVertical: 10,
			borderBottomWidth: isLast ? 0 : 1,
			borderBottomColor: "rgba(125,125,125,0.1)",
		}}
	>
		<Text style={{ opacity: 0.7, fontSize: 14 }}>{label}</Text>
		<Text
			style={{
				fontFamily: "monospace",
				fontSize: 13,
				maxWidth: "60%",
				textAlign: "right",
			}}
			numberOfLines={1}
		>
			{value ?? "N/A"}
		</Text>
	</View>
);

export default function Settings() {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const router = useRouter();

	const [showClearConversationsConfirm, setShowClearConversationsConfirm] =
		useState(false);
	const [showResetEverythingConfirm, setShowResetEverythingConfirm] =
		useState(false);
	const [checkingForUpdates, setCheckingForUpdates] = useState(false);
	const [showUpToDate, setShowUpToDate] = useState(false);
	const [updateInfo, setUpdateInfo] = useState<ModelUpdateInfo | null>(null);
	const [showUpdateNotification, setShowUpdateNotification] = useState(false);

	// Local auth state
	const localAuthEnabled = useValue("localAuthEnabled") as boolean | undefined;
	const [localAuthToggle, setLocalAuthToggle] = useState(
		localAuthEnabled === true,
	);
	const [isAuthenticating, setIsAuthenticating] = useState(false);
	const [authStatusMessage, setAuthStatusMessage] = useState<string | null>(
		null,
	);
	const [isLocalAuthAvailable, setIsLocalAuthAvailable] = useState<
		boolean | null
	>(null);

	const configVersion = useValue("ai_chat_model_config_version") as
		| string
		| undefined;
	const downloadedAt = useValue("ai_chat_model_downloadedAt") as
		| string
		| undefined;
	const modelCard = getStoredModelCard();

	// Easter egg state - tap logo 5 times to unlock game
	const [logoTapCount, setLogoTapCount] = useState(0);
	const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Developer info modal state - tap hardware info 7 times
	const [hardwareInfoTapCount, setHardwareInfoTapCount] = useState(0);
	const hardwareInfoTapTimeoutRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	const [showDevInfoModal, setShowDevInfoModal] = useState(false);
	const [devTapMessage, setDevTapMessage] = useState<string | null>(null);

	// Get device capabilities and runtime config
	const deviceCapabilities = useMemo(() => getDeviceCapabilities(), []);
	const { runtimeConfig } = useAIChat();

	const handleLogoTap = () => {
		Haptics.selectionAsync();

		// Clear previous timeout
		if (tapTimeoutRef.current) {
			clearTimeout(tapTimeoutRef.current);
		}

		const newCount = logoTapCount + 1;
		setLogoTapCount(newCount);

		if (newCount >= 5) {
			// Easter egg activated!
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
			setLogoTapCount(0);
			router.push("/game");
		} else {
			// Reset tap count after 1 second of no taps
			tapTimeoutRef.current = setTimeout(() => {
				setLogoTapCount(0);
			}, 1000);
		}
	};

	const handleHardwareInfoTap = () => {
		Haptics.selectionAsync();

		// Clear previous timeout
		if (hardwareInfoTapTimeoutRef.current) {
			clearTimeout(hardwareInfoTapTimeoutRef.current);
		}

		const newCount = hardwareInfoTapCount + 1;
		setHardwareInfoTapCount(newCount);

		if (newCount >= 7) {
			// Developer modal activated!
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
			setHardwareInfoTapCount(0);
			setDevTapMessage(null);
			setShowDevInfoModal(true);
		} else if (newCount >= 3) {
			// Show remaining taps message after 3rd tap
			const remaining = 7 - newCount;
			setDevTapMessage(
				`Developer info - ${remaining} tap${remaining === 1 ? "" : "s"} remaining`,
			);
			// Reset tap count and message after 1 second of no taps
			hardwareInfoTapTimeoutRef.current = setTimeout(() => {
				setHardwareInfoTapCount(0);
				setDevTapMessage(null);
			}, 1000);
		} else {
			// Reset tap count after 1 second of no taps
			hardwareInfoTapTimeoutRef.current = setTimeout(() => {
				setHardwareInfoTapCount(0);
			}, 1000);
		}
	};

	const handleShareDevInfo = async () => {
		const sampling = runtimeConfig?.sampling;
		const message = `*Whisper Developer Info*

*Hardware*
Device: ${deviceCapabilities.modelName ?? "N/A"}
Platform: ${deviceCapabilities.platform}
Device Type: ${deviceCapabilities.deviceType}
RAM: ${deviceCapabilities.ramGB.toFixed(2)} GB
CPU Architecture: ${deviceCapabilities.cpuArch ?? "N/A"}
CPU Cores: ${deviceCapabilities.cpuCoreCount ?? "N/A"}

*Model Configuration*
Name: ${modelCard?.name ?? "N/A"}
Size: ${modelCard ? `${modelCard.sizeGB.toFixed(2)} GB` : "N/A"}
Config Version: ${configVersion ?? "N/A"}
Context Size: ${runtimeConfig?.n_ctx ?? "N/A"}
GPU Layers: ${runtimeConfig?.n_gpu_layers ?? "N/A"}
Threads: ${runtimeConfig?.n_threads ?? "N/A"}
Flash Attention: ${runtimeConfig?.flash_attn ? "Yes" : "No"}
KV Cache: ${runtimeConfig ? `${runtimeConfig.cache_type_k} / ${runtimeConfig.cache_type_v}` : "N/A"}
${
	sampling
		? `
*Sampling*
Temperature: ${sampling.temperature ?? "N/A"}
Top K: ${sampling.top_k ?? "N/A"}
Top P: ${sampling.top_p ?? "N/A"}
Min P: ${sampling.min_p ?? "N/A"}`
		: ""
}`;

		try {
			await Share.share({ message });
		} catch (error) {
			console.error("[Settings] Failed to share:", error);
		}
	};

	// Cleanup timeouts on unmount
	useEffect(() => {
		return () => {
			if (tapTimeoutRef.current) {
				clearTimeout(tapTimeoutRef.current);
			}
			if (hardwareInfoTapTimeoutRef.current) {
				clearTimeout(hardwareInfoTapTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		setLocalAuthToggle(localAuthEnabled === true);
	}, [localAuthEnabled]);

	useEffect(() => {
		checkLocalAuthAvailable().then((result) => {
			setIsLocalAuthAvailable(result.available);
			if (!result.available) {
				if (!result.hasHardware) {
					setAuthStatusMessage(
						"Biometric authentication not available on this device",
					);
				} else if (!result.isEnrolled) {
					setAuthStatusMessage(
						"No biometric data enrolled. Set up in device settings.",
					);
				}
			}
		});
	}, []);

	const handleLocalAuthToggle = async (value: boolean) => {
		if (value) {
			// Enabling - verify auth works first
			setIsAuthenticating(true);
			setAuthStatusMessage(null);

			const result = await authenticate();

			setIsAuthenticating(false);

			if (result.success) {
				setLocalAuthToggle(true);
				setLocalAuth(true);
				setAuthStatusMessage("Lock screen enabled");
				setTimeout(() => setAuthStatusMessage(null), 2000);
			} else {
				setLocalAuthToggle(false);
				setAuthStatusMessage(result.error || "Authentication failed");
			}
		} else {
			// Disabling - no auth check needed
			setLocalAuthToggle(false);
			setLocalAuth(false);
			setAuthStatusMessage(null);
		}
	};

	const handleCheckForUpdates = async () => {
		if (!downloadedAt || !configVersion) {
			return;
		}

		setCheckingForUpdates(true);
		try {
			const result = await checkForModelUpdates();
			if (result.hasUpdate) {
				setUpdateInfo(result);
				setShowUpdateNotification(true);
			} else {
				// Show "Up to date!" for 2 seconds
				setShowUpToDate(true);
				setTimeout(() => {
					setShowUpToDate(false);
				}, 2000);
			}
		} catch (error) {
			console.error("[Settings] Failed to check for updates:", error);
		} finally {
			setCheckingForUpdates(false);
		}
	};

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: theme.background }}
			edges={["top", "left", "right"]}
		>
			{/* Header */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					padding: 16,
					borderBottomWidth: 1,
					borderBottomColor: "rgba(125,125,125,0.15)",
					position: "relative",
				}}
			>
				<Button onPress={() => router.back()} variant="ghost" size="icon">
					<ChevronLeft color={theme.textMuted} strokeWidth={2} size={24} />
				</Button>
				<Text
					style={{
						fontSize: 18,
						fontWeight: "600",
						position: "absolute",
						left: 0,
						right: 0,
						textAlign: "center",
					}}
					pointerEvents="none"
				>
					Settings
				</Text>
			</View>

			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				{/* Logo Section - Tap 5 times for easter egg */}
				<TouchableOpacity
					onPress={handleLogoTap}
					activeOpacity={0.8}
					style={{
						justifyContent: "center",
						alignItems: "center",
						width: "100%",
						paddingHorizontal: 24,
						paddingTop: 24,
					}}
				>
					<Logo fontSize={56} />
				</TouchableOpacity>

				<View style={{ paddingHorizontal: 24 }}>
					{/* Appearance Section */}
					<View style={{ marginBottom: 8 }}>
						<Text
							variant="label"
							style={{
								fontSize: 13,
								fontWeight: "600",
								opacity: 0.7,
								marginBottom: 12,
							}}
						>
							APPEARANCE
						</Text>
						<ModeToggle showLabel={true} />

						{/* Chat Background */}
						<TouchableOpacity
							style={{
								marginTop: 16,
								backgroundColor: theme.card,
								borderRadius: BORDER_RADIUS / 2,
								padding: 14,
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
							}}
							onPress={() => {
								Haptics.selectionAsync();
								router.push("/settings/background");
							}}
							activeOpacity={0.7}
						>
							<Text style={{ fontSize: 16, fontWeight: "500" }}>
								Chat Background
							</Text>
							<ChevronRight color={theme.textMuted} strokeWidth={2} size={20} />
						</TouchableOpacity>

						{/* App Icon */}
						<TouchableOpacity
							style={{
								marginTop: 16,
								backgroundColor: theme.card,
								borderRadius: BORDER_RADIUS / 2,
								padding: 14,
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
							}}
							onPress={() => {
								Haptics.selectionAsync();
								router.push("/settings/app-icon");
							}}
							activeOpacity={0.7}
						>
							<Text style={{ fontSize: 16, fontWeight: "500" }}>App Icon</Text>
							<ChevronRight color={theme.textMuted} strokeWidth={2} size={20} />
						</TouchableOpacity>
					</View>

					<Separator />

					{/* Status Section */}
					<View style={{ marginBottom: 8 }}>
						<Text
							variant="label"
							style={{
								fontSize: 13,
								fontWeight: "600",
								opacity: 0.7,
								marginBottom: 12,
							}}
						>
							STATUS
						</Text>
						<View style={{ marginBottom: 16 }}>
							<Text
								style={{
									fontSize: 15,
									fontWeight: "500",
									marginBottom: 6,
								}}
							>
								AI Chat Version
							</Text>
							{modelCard && configVersion && (
								<Text
									style={{
										fontSize: 12,
										opacity: 0.6,
										marginBottom: 12,
										lineHeight: 18,
									}}
								>
									{modelCard.name} • v{configVersion} •{" "}
									{modelCard.sizeGB.toFixed(1)} GB
								</Text>
							)}
							<Button
								variant="secondary"
								size="sm"
								onPress={handleCheckForUpdates}
								disabled={
									checkingForUpdates ||
									showUpToDate ||
									!downloadedAt ||
									!configVersion
								}
							>
								{checkingForUpdates
									? "Checking..."
									: showUpToDate
										? "Up to date!"
										: "Check for Updates"}
							</Button>

							{/* Hardware Info - tap 7 times for developer modal */}
							<TouchableOpacity
								onPress={handleHardwareInfoTap}
								activeOpacity={0.7}
								style={{ marginTop: 16 }}
							>
								<Text
									style={{
										fontSize: 12,
										opacity: 0.5,
										lineHeight: 18,
									}}
								>
									{deviceCapabilities.modelName ?? "Unknown Device"} •{" "}
									{deviceCapabilities.ramGB.toFixed(1)} GB RAM •{" "}
									{deviceCapabilities.cpuCoreCount ?? "?"} cores
								</Text>
							</TouchableOpacity>
						</View>
					</View>

					<Separator />

					{/* Security Section */}
					<View style={{ marginBottom: 8 }}>
						<Text
							variant="label"
							style={{
								fontSize: 13,
								fontWeight: "600",
								opacity: 0.7,
								marginBottom: 12,
							}}
						>
							SECURITY
						</Text>
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								justifyContent: "space-between",
								gap: 12,
								paddingVertical: 14,
								borderRadius: 12,
							}}
						>
							<View style={{ flex: 1, marginRight: 12 }}>
								<Text style={{ fontSize: 15, fontWeight: "500" }}>
									Lock Screen
								</Text>
								<Text
									style={{
										fontSize: 12,
										opacity: 0.6,
										marginTop: 4,
									}}
								>
									Require Face ID, Touch ID, or passcode to open Whisper
								</Text>
							</View>
							<Switch
								value={isAuthenticating || localAuthToggle}
								onValueChange={handleLocalAuthToggle}
								disabled={isAuthenticating || isLocalAuthAvailable === false}
								trackColor={{ false: theme.muted, true: theme.green }}
								thumbColor={theme.background}
								ios_backgroundColor={theme.muted}
							/>
						</View>
						{authStatusMessage && (
							<Text
								style={{
									fontSize: 12,
									color:
										localAuthToggle || authStatusMessage.includes("enabled")
											? theme.green
											: theme.textMuted,
									marginTop: 8,
								}}
							>
								{authStatusMessage}
							</Text>
						)}
						{isAuthenticating && (
							<Text
								style={{
									fontSize: 12,
									color: theme.textMuted,
									marginTop: 8,
								}}
							>
								Verifying...
							</Text>
						)}
					</View>

					<Separator />

					{/* Data Management Section */}
					<View style={{ marginBottom: 8 }}>
						<Text
							variant="label"
							style={{
								fontSize: 13,
								fontWeight: "600",
								opacity: 0.7,
								marginBottom: 8,
							}}
						>
							DANGER AREA
						</Text>

						{/* Clear Conversations */}
						<View style={{ marginBottom: 24 }}>
							<Text
								style={{
									fontSize: 15,
									fontWeight: "500",
									marginBottom: 6,
								}}
							>
								Clear Conversations
							</Text>
							<Text
								style={{
									fontSize: 13,
									opacity: 0.6,
									marginBottom: 12,
									lineHeight: 18,
								}}
							>
								Delete all chat history while keeping your settings and AI model
							</Text>
							{showClearConversationsConfirm ? (
								<View style={{ gap: 8 }}>
									<Text
										style={{
											fontSize: 13,
											color: theme.destructive,
											marginBottom: 4,
										}}
									>
										Are you sure? This cannot be undone.
									</Text>
									<View style={{ flexDirection: "row", gap: 8 }}>
										<Button
											variant="destructive"
											size="sm"
											style={{ flex: 1 }}
											onPress={() => {
												clearConversations();
												setShowClearConversationsConfirm(false);
												router.back();
											}}
										>
											Delete All
										</Button>
										<Button
											variant="outline"
											size="sm"
											style={{ flex: 1 }}
											onPress={() => setShowClearConversationsConfirm(false)}
										>
											Cancel
										</Button>
									</View>
								</View>
							) : (
								<Button
									variant="secondary"
									size="sm"
									onPress={() => setShowClearConversationsConfirm(true)}
								>
									Clear Conversations...
								</Button>
							)}
						</View>

						{/* Reset Everything */}
						<View style={{ marginBottom: 16 }}>
							<Text
								style={{
									fontSize: 15,
									fontWeight: "500",
									marginBottom: 6,
								}}
							>
								Reset Everything
							</Text>
							<Text
								style={{
									fontSize: 13,
									opacity: 0.6,
									marginBottom: 12,
									lineHeight: 18,
								}}
							>
								Purge everything including your AI model, settings, and all
								conversations
							</Text>
							{showResetEverythingConfirm ? (
								<View style={{ gap: 8 }}>
									<Text
										style={{
											fontSize: 13,
											color: theme.destructive,
											fontWeight: "600",
											marginBottom: 4,
										}}
									>
										This will delete EVERYTHING. This cannot be undone.
									</Text>
									<View style={{ flexDirection: "row", gap: 8 }}>
										<Button
											variant="destructive"
											size="sm"
											style={{ flex: 1 }}
											onPress={() => {
												resetEverything();
												setShowResetEverythingConfirm(false);
												router.replace("/");
											}}
										>
											Purge
										</Button>
										<Button
											variant="outline"
											size="sm"
											style={{ flex: 1 }}
											onPress={() => setShowResetEverythingConfirm(false)}
										>
											Cancel
										</Button>
									</View>
								</View>
							) : (
								<Button
									variant="destructive"
									size="sm"
									onPress={() => setShowResetEverythingConfirm(true)}
								>
									Purge Everything...
								</Button>
							)}
						</View>
					</View>

					<Separator />

					{/* About Section */}
					<View style={{ marginBottom: 8 }}>
						<Text
							variant="label"
							style={{
								fontSize: 13,
								fontWeight: "600",
								opacity: 0.7,
								marginBottom: 12,
							}}
						>
							WITH THANKS TO
						</Text>

						{/* Open Source Credits */}
						<Button
							variant="secondary"
							size="sm"
							style={{ flex: 1 }}
							onPress={() => {
								Haptics.selectionAsync();
								router.push("/settings/credits");
							}}
						>
							Open Source Credits
						</Button>
					</View>

					<Separator />

					{/* Copyright Footer */}
					<View
						style={{
							alignItems: "center",
							paddingVertical: 16,
							gap: 4,
						}}
					>
						<Text
							style={{
								fontSize: 12,
								opacity: 0.5,
								textAlign: "center",
							}}
						>
							Copyright © 2025 Whisper.
						</Text>
						<Text
							style={{
								fontSize: 10,
								opacity: 0.4,
								textAlign: "center",
							}}
						>
							Trading style of Ava Technologies Global LTD.
						</Text>
						<Text
							style={{
								fontSize: 12,
								opacity: 0.6,
								textAlign: "center",
								marginTop: 12,
								fontWeight: 600,
							}}
						>
							Talk freely. Think privately.
						</Text>
					</View>
				</View>
			</ScrollView>

			{/* Developer Info Toast */}
			{devTapMessage && (
				<View
					style={{
						position: "absolute",
						bottom: 64,
						left: 0,
						right: 0,
						alignItems: "center",
						pointerEvents: "none",
					}}
				>
					<View
						style={{
							backgroundColor: theme.foreground,
							paddingHorizontal: 20,
							paddingVertical: 12,
							borderRadius: 24,
							shadowColor: "#000",
							shadowOffset: { width: 0, height: 2 },
							shadowOpacity: 0.25,
							shadowRadius: 4,
							elevation: 5,
						}}
					>
						<Text
							style={{
								fontSize: 14,
								fontWeight: "500",
								color: theme.background,
							}}
						>
							{devTapMessage}
						</Text>
					</View>
				</View>
			)}

			{/* Developer Info Modal */}
			<BottomSheet
				isVisible={showDevInfoModal}
				onClose={() => setShowDevInfoModal(false)}
				title="Developer Info"
				snapPoints={[0.95]}
			>
				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={{
						padding: 16,
						paddingTop: 32,
						paddingBottom: 100,
					}}
					showsVerticalScrollIndicator={false}
				>
					{/* Hardware Section */}
					<Text
						variant="label"
						style={{
							fontSize: 13,
							fontWeight: "600",
							opacity: 0.7,
							marginBottom: 8,
						}}
					>
						HARDWARE
					</Text>
					<View
						style={{
							backgroundColor: theme.background,
							borderRadius: BORDER_RADIUS / 2,
							paddingHorizontal: 12,
							marginBottom: 24,
						}}
					>
						<InfoRow label="Device" value={deviceCapabilities.modelName} />
						<InfoRow label="Platform" value={deviceCapabilities.platform} />
						<InfoRow
							label="Device Type"
							value={deviceCapabilities.deviceType}
						/>
						<InfoRow
							label="RAM"
							value={`${deviceCapabilities.ramGB.toFixed(2)} GB`}
						/>
						<InfoRow
							label="CPU Architecture"
							value={deviceCapabilities.cpuArch}
						/>
						<InfoRow
							label="CPU Cores"
							value={deviceCapabilities.cpuCoreCount}
							isLast
						/>
					</View>

					{/* Model Configuration Section */}
					<Text
						variant="label"
						style={{
							fontSize: 13,
							fontWeight: "600",
							opacity: 0.7,
							marginBottom: 8,
						}}
					>
						MODEL CONFIGURATION
					</Text>
					<View
						style={{
							backgroundColor: theme.background,
							borderRadius: BORDER_RADIUS / 2,
							paddingHorizontal: 12,
							marginBottom: 24,
						}}
					>
						<InfoRow label="Name" value={modelCard?.name} />
						<InfoRow
							label="Size"
							value={
								modelCard ? `${modelCard.sizeGB.toFixed(2)} GB` : undefined
							}
						/>
						<InfoRow label="Config Version" value={configVersion} />
						<InfoRow label="Context Size" value={runtimeConfig?.n_ctx} />
						<InfoRow label="GPU Layers" value={runtimeConfig?.n_gpu_layers} />
						<InfoRow label="Threads" value={runtimeConfig?.n_threads} />
						<InfoRow
							label="Flash Attention"
							value={runtimeConfig?.flash_attn ? "Yes" : "No"}
						/>
						<InfoRow
							label="KV Cache Type"
							value={
								runtimeConfig
									? `${runtimeConfig.cache_type_k} / ${runtimeConfig.cache_type_v}`
									: undefined
							}
						/>
						<InfoRow
							label="Stop Words"
							value={runtimeConfig?.stop?.join(", ") || "None"}
							isLast
						/>
					</View>

					{/* Sampling Parameters Section */}
					{runtimeConfig?.sampling && (
						<>
							<Text
								variant="label"
								style={{
									fontSize: 13,
									fontWeight: "600",
									opacity: 0.7,
									marginBottom: 8,
								}}
							>
								SAMPLING PARAMETERS
							</Text>
							<View
								style={{
									backgroundColor: theme.background,
									borderRadius: BORDER_RADIUS / 2,
									paddingHorizontal: 12,
								}}
							>
								<InfoRow
									label="Temperature"
									value={runtimeConfig.sampling.temperature}
								/>
								<InfoRow label="Top K" value={runtimeConfig.sampling.top_k} />
								<InfoRow label="Top P" value={runtimeConfig.sampling.top_p} />
								<InfoRow label="Min P" value={runtimeConfig.sampling.min_p} />
								<InfoRow
									label="Repeat Penalty"
									value={runtimeConfig.sampling.penalty_repeat}
								/>
								<InfoRow
									label="Penalty Last N"
									value={runtimeConfig.sampling.penalty_last_n}
								/>
								<InfoRow
									label="Seed"
									value={runtimeConfig.sampling.seed}
									isLast
								/>
							</View>
						</>
					)}

					{/* Share Button */}
					<Button
						variant="link"
						size="sm"
						onPress={handleShareDevInfo}
						style={{ marginTop: 24 }}
					>
						Share
					</Button>
				</ScrollView>
			</BottomSheet>

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
	);
}
