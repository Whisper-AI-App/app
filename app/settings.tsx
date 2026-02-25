import { Logo } from "@/components/logo";
import { ModelUpdateNotification } from "@/components/model-update-notification";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import {
	checkForModelUpdates,
	getStoredModelCard,
} from "@/src/actions/ai/model-config";
import type { ModelUpdateInfo } from "@/src/actions/ai/types";
import {
	type ExportFormat,
	exportAllChats,
	getChatsSummary,
} from "@/src/actions/export";
import { clearConversations, resetEverything } from "@/src/actions/reset";
import {
	authenticate,
	checkLocalAuthAvailable,
	setLocalAuth,
} from "@/src/actions/settings";
import { Colors } from "@/theme/colors";
import { BORDER_RADIUS } from "@/theme/globals";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Switch, TouchableOpacity, useColorScheme } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useValue } from "tinybase/ui-react";

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

	// Export state
	const [isExporting, setIsExporting] = useState(false);
	const [exportMessage, setExportMessage] = useState<string | null>(null);
	const [chatsSummary, setChatsSummary] = useState({
		chatCount: 0,
		messageCount: 0,
	});
	const [exportFormat, setExportFormat] = useState<ExportFormat>("markdown");

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

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (tapTimeoutRef.current) {
				clearTimeout(tapTimeoutRef.current);
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

	// Load chats summary on mount
	useEffect(() => {
		setChatsSummary(getChatsSummary());
	}, []);

	const handleExportChats = async () => {
		if (chatsSummary.chatCount === 0) {
			setExportMessage("No chats to export");
			setTimeout(() => setExportMessage(null), 2000);
			return;
		}

		setIsExporting(true);
		setExportMessage(null);
		Haptics.selectionAsync();

		try {
			const result = await exportAllChats(exportFormat);
			if (result) {
				setExportMessage("Export complete!");
			} else {
				setExportMessage("No chats to export");
			}
		} catch (error) {
			console.error("[Settings] Export failed:", error);
			setExportMessage("Export failed. Please try again.");
		} finally {
			setIsExporting(false);
			setTimeout(() => setExportMessage(null), 3000);
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
								marginBottom: 12,
							}}
						>
							DATA MANAGEMENT
						</Text>

						{/* Export Chats */}
						<View style={{ marginBottom: 16 }}>
							<Text
								style={{
									fontSize: 15,
									fontWeight: "500",
									marginBottom: 6,
								}}
							>
								Export Chats
							</Text>
							<Text
								style={{
									fontSize: 13,
									opacity: 0.6,
									marginBottom: 12,
									lineHeight: 18,
								}}
							>
								Export all {chatsSummary.chatCount} conversations (
								{chatsSummary.messageCount} messages)
							</Text>

							{/* Format Picker */}
							<View style={{ marginBottom: 12 }}>
								<Text
									style={{
										fontSize: 12,
										opacity: 0.7,
										marginBottom: 8,
									}}
								>
									Format
								</Text>
								<View style={{ flexDirection: "row", gap: 8 }}>
									<TouchableOpacity
										style={{
											flex: 1,
											paddingVertical: 10,
											paddingHorizontal: 14,
											borderRadius: 8,
											backgroundColor:
												exportFormat === "markdown"
													? theme.primary
													: theme.card,
											borderWidth: 1,
											borderColor:
												exportFormat === "markdown"
													? theme.primary
													: "transparent",
										}}
										onPress={() => {
											Haptics.selectionAsync();
											setExportFormat("markdown");
										}}
										activeOpacity={0.7}
									>
										<Text
											style={{
												fontSize: 13,
												fontWeight: "500",
												textAlign: "center",
												color:
													exportFormat === "markdown"
														? theme.background
														: theme.text,
											}}
										>
											Markdown
										</Text>
									</TouchableOpacity>
									<TouchableOpacity
										style={{
											flex: 1,
											paddingVertical: 10,
											paddingHorizontal: 14,
											borderRadius: 8,
											backgroundColor:
												exportFormat === "json" ? theme.primary : theme.card,
											borderWidth: 1,
											borderColor:
												exportFormat === "json" ? theme.primary : "transparent",
										}}
										onPress={() => {
											Haptics.selectionAsync();
											setExportFormat("json");
										}}
										activeOpacity={0.7}
									>
										<Text
											style={{
												fontSize: 13,
												fontWeight: "500",
												textAlign: "center",
												color:
													exportFormat === "json"
														? theme.background
														: theme.text,
											}}
										>
											JSON
										</Text>
									</TouchableOpacity>
								</View>
							</View>

							<Button
								variant="secondary"
								size="sm"
								onPress={handleExportChats}
								disabled={isExporting || chatsSummary.chatCount === 0}
							>
								{isExporting ? "Exporting..." : `Export`}
							</Button>
							{exportMessage && (
								<Text
									style={{
										fontSize: 12,
										color: exportMessage.includes("failed")
											? theme.destructive
											: theme.green,
										marginTop: 8,
									}}
								>
									{exportMessage}
								</Text>
							)}
						</View>
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
												if (router.canDismiss()) {
													router.dismissAll();
												}
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
