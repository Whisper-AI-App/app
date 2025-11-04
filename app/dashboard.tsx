import Chat from "@/components/chat";
import { ChatPreview } from "@/components/chat-preview";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { SearchBar } from "@/components/ui/searchbar";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIChat } from "@/contexts/AIChatContext";
import { resetEverything } from "@/src/actions/reset";
import { store } from "@/src/store";
import { Colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { Settings } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRowIds, useSortedRowIds, useValue } from "tinybase/ui-react";

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

	// Create a map of chatId -> latest message for preview
	const chatPreviews = useMemo(() => {
		return chatIds.map((chatId) => {
			const chat = store.getRow("chats", chatId);

			// Find the latest message for this chat
			const chatMessages = messageIds
				.map((id) => store.getRow("messages", id))
				.filter((msg) => msg?.chatId === chatId)
				.sort(
					(a, b) =>
						new Date(b?.createdAt || 0).getTime() -
						new Date(a?.createdAt || 0).getTime(),
				);

			const latestMessage = chatMessages[0];

			return {
				chatId,
				name: chat?.name || "Untitled Chat",
				text: latestMessage?.contents || "No messages yet",
				date: new Date(chat?.createdAt || Date.now()),
			};
		});
	}, [chatIds, messageIds]);

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
					onSearch={(query) => console.log("Searching for:", query)}
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
						<SheetTitle>Whisper</SheetTitle>
						<SheetDescription>Settings</SheetDescription>
					</SheetHeader>
					<View style={{ paddingHorizontal: 16 }}>
						<ModeToggle />

						<Text>Delete Everything</Text>
						<Button
							variant="destructive"
							onPress={() => {
								resetEverything();
								router.replace("/");
							}}
						>
							Burn Everything
						</Button>
					</View>
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
								onPress={() => {
									setSelectedChatId(preview.chatId);
									setIsChatOpen(true);
								}}
							/>
						</View>
					))
				) : (
					<View style={{ padding: 32, alignItems: "center", gap: 16 }}>
						<Text style={{ opacity: 0.5 }}>No chats yet</Text>
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
