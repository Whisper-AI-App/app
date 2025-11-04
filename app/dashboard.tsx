import Chat from "@/components/chat";
import { ChatPreview } from "@/components/chat-preview";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useValue, useSortedRowIds, useRow, useRowIds } from "tinybase/ui-react";
import { store } from "@/src/store";

export default function Dashboard() {
	const router = useRouter();
	const version = useValue("version");

	const [settingsOpen, setSettingsOpen] = useState(false);
	const [selectedChatId, setSelectedChatId] = useState<string | undefined>(undefined);

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
		return chatIds.map(chatId => {
			const chat = store.getRow("chats", chatId);

			// Find the latest message for this chat
			const chatMessages = messageIds
				.map(id => store.getRow("messages", id))
				.filter(msg => msg?.chatId === chatId)
				.sort((a, b) =>
					new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()
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
					marginBottom: 16,
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
				>
					<Avatar>
						<AvatarFallback>{version}</AvatarFallback>
					</Avatar>
				</Button>
			</View>

			<Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Whisper</SheetTitle>
						<SheetDescription>Settings</SheetDescription>
					</SheetHeader>
					<View style={{ paddingHorizontal: 16 }}>
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
					chatPreviews.map((preview) => (
						<View key={preview.chatId} style={{ paddingBottom: 12 }}>
							<ChatPreview
								chatId={preview.chatId}
								date={preview.date}
								name={preview.name}
								text={preview.text}
								onPress={() => setSelectedChatId(preview.chatId)}
							/>
						</View>
					))
				) : (
					<View style={{ padding: 32, alignItems: "center" }}>
						<Text style={{ opacity: 0.5 }}>No chats yet. Start a conversation!</Text>
					</View>
				)}
			</ScrollView>

			<View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
				<Chat
					key={selectedChatId ?? "new"}
					chatId={selectedChatId}
					onClose={() => setSelectedChatId(undefined)}
				/>
			</View>
		</SafeAreaView>
	);
}
