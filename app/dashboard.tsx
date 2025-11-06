import Chat from "@/components/chat";
import { ChatPreview } from "@/components/chat-preview";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { SearchBar } from "@/components/ui/searchbar";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIChat } from "@/contexts/AIChatContext";
import { clearConversations, resetEverything } from "@/src/actions/reset";
import { Colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { Settings } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import {
	useRowIds,
	useSortedRowIds,
	useTable,
	useValue,
} from "tinybase/ui-react";

export default function Dashboard() {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const router = useRouter();
	const version = useValue("version");

	const [settingsOpen, setSettingsOpen] = useState(false);
	const [selectedChatId, setSelectedChatId] = useState<string | undefined>(
		undefined,
	);
	const [isChatOpen, setIsChatOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [showClearConversationsConfirm, setShowClearConversationsConfirm] =
		useState(false);
	const [showResetEverythingConfirm, setShowResetEverythingConfirm] =
		useState(false);

	const aiChat = useAIChat();

	// Check for completed model using useValue
	const downloadedAt = useValue("ai_chat_model_downloadedAt") as
		| string
		| undefined;
	const fileUri = useValue("ai_chat_model_fileUri") as string | undefined;

	// Get all chat IDs sorted by creation date (newest first)
	const chatIds = useSortedRowIds("chats", "createdAt", true);

	// Get all message IDs to find latest message for each chat
	const messageIds = useRowIds("messages");

	// Subscribe to the entire chats and messages tables to trigger re-render when any data changes
	const chatsTable = useTable("chats");
	const messagesTable = useTable("messages");

	// Create a map of chatId -> latest message for preview
	const chatPreviews = useMemo(() => {
		const allPreviews = chatIds.map((chatId) => {
			const chat = chatsTable[chatId];

			// Find the latest message for this chat
			const chatMessages = messageIds
				.map((id) => messagesTable[id])
				.filter((msg) => msg?.chatId === chatId)
				.sort(
					(a, b) =>
						new Date(b?.createdAt ? String(b?.createdAt) : 0).getTime() -
						new Date(a?.createdAt ? String(a?.createdAt) : 0).getTime(),
				);

			const latestMessage = chatMessages[0];

			return {
				chatId,
				name: chat?.name || "Untitled Chat",
				text: latestMessage?.contents || "No messages yet",
				date: new Date(chat?.createdAt ? String(chat.createdAt) : Date.now()),
			};
		});

		// Filter based on search query
		const query = searchQuery.trim().toLowerCase();
		if (!query) {
			return allPreviews;
		}

		return allPreviews.filter((preview) => {
			const nameMatch = String(preview.name).toLowerCase().includes(query);
			const textMatch = String(preview.text).toLowerCase().includes(query);
			return nameMatch || textMatch;
		});
	}, [chatIds, messageIds, searchQuery, chatsTable, messagesTable]);

	// Check for completed model on mount and load it if available
	useEffect(() => {
		if (downloadedAt && fileUri && !aiChat.isLoaded) {
			// Model is downloaded but not loaded yet, load it
			console.log("[Dashboard] Loading model from:", fileUri);
			aiChat
				.loadModel({ ggufPath: fileUri })
				.then(() => {
					console.log("[Dashboard] Model loaded successfully");
				})
				.catch((error) => {
					console.error("[Dashboard] Failed to load model:", error);
				});
		}
	}, [downloadedAt, fileUri, aiChat]);

	return (
		<SafeAreaView style={{ flex: 1 }}>
			<View
				style={{
					width: "100%",
					justifyContent: "space-between",
					alignItems: "center",
					flexDirection: "row",
					padding: 16,
					gap: 16,
					borderBottomColor: "rgba(125,125,125,0.15)",
					borderBottomWidth: 1,
				}}
			>
				<SearchBar
					placeholder="Search for anything..."
					onSearch={setSearchQuery}
					loading={false}
					containerStyle={{ flex: 1 }}
				/>

				<Button
					onPress={() => setSettingsOpen(true)}
					variant="ghost"
					size="icon"
					style={{ backgroundColor: theme.accent }}
				>
					<Settings color={theme.textMuted} strokeWidth={2} size={20} />
				</Button>
			</View>

			<Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
				<SheetContent>
					<SheetHeader>
						<View
							style={{
								alignItems: "flex-start",
								width: "100%",
								height: 96,
								display: "flex",
								marginTop: 12,
							}}
						>
							<Logo fontSize={48} />
						</View>
					</SheetHeader>

					<ScrollView
						style={{ flex: 1 }}
						contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
					>
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
									Delete all chat history while keeping your settings and AI
									model
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
													setSettingsOpen(false);
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
					</ScrollView>
				</SheetContent>
			</Sheet>

			<ScrollView
				style={{
					flex: 1,
					paddingHorizontal: 16,
				}}
			>
				{chatPreviews.length > 0 ? (
					chatPreviews.map((preview, index, array) => (
						<View
							key={preview.chatId}
							style={{
								paddingBottom: index >= array.length - 1 ? 128 : 12,
								paddingTop: index === 0 ? 16 : 0,
							}}
						>
							<ChatPreview
								chatId={preview.chatId}
								date={preview.date}
								name={preview.name}
								text={preview.text}
								peekOnMount={index === 0}
								onPress={() => {
									setSelectedChatId(preview.chatId);
									setIsChatOpen(true);
								}}
							/>
						</View>
					))
				) : (
					<View style={{ padding: 32, alignItems: "center", gap: 16 }}>
						<Text style={{ opacity: 0.5 }}>
							{searchQuery.trim() ? "No chats found" : "No chats yet"}
						</Text>
						{!searchQuery.trim() && (
							<Button
								variant="secondary"
								size="sm"
								onPress={() => {
									setSelectedChatId(undefined);
									setIsChatOpen(true);
								}}
							>
								Start a conversation
							</Button>
						)}
					</View>
				)}
			</ScrollView>

			<View
				style={{
					position: "absolute",
					bottom: 0,
					left: 0,
					width: "100%",
					paddingHorizontal: 16,
					paddingBottom: 56,
				}}
			>
				<View style={{ borderRadius: 24, boxShadow: "0 0 5px pink" }}>
					<Chat
						chatId={selectedChatId}
						isOpen={isChatOpen}
						onClose={() => {
							setSelectedChatId(undefined);
							setIsChatOpen(false);
						}}
					/>
				</View>
			</View>
		</SafeAreaView>
	);
}
