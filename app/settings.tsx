import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { clearConversations, resetEverything } from "@/src/actions/reset";
import { Colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { useColorScheme } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Settings() {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const router = useRouter();

	const [showClearConversationsConfirm, setShowClearConversationsConfirm] =
		useState(false);
	const [showResetEverythingConfirm, setShowResetEverythingConfirm] =
		useState(false);

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
				>
					Settings
				</Text>
			</View>

			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				{/* Logo Section */}
				<View
					style={{
						justifyContent: "center",
						alignItems: "center",
						width: "100%",
						paddingHorizontal: 24,
						paddingTop: 24,
					}}
				>
					<Logo fontSize={56} />
				</View>

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
		</SafeAreaView>
	);
}
