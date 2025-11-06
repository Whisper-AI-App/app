import Chat from "@/components/chat";
import { ChatPreview } from "@/components/chat-preview";
import { ModelLoadError } from "@/components/model-load-error";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/searchbar";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIChat } from "@/contexts/AIChatContext";
import { useColor } from "@/hooks/useColor";
import { Colors } from "@/theme/colors";
import { ImageBackground } from "expo-image";
import { useRouter } from "expo-router";
import { Settings } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Dimensions, useColorScheme } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { Defs, RadialGradient, Rect, Stop, Svg } from "react-native-svg";
import {
	useRowIds,
	useSortedRowIds,
	useTable,
	useValue,
} from "tinybase/ui-react";

export default function Dashboard() {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const backgroundColor = useColor("background");

	const router = useRouter();
	const version = useValue("version");

	const [selectedChatId, setSelectedChatId] = useState<string | undefined>(
		undefined,
	);
	const [isChatOpen, setIsChatOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [modelLoadError, setModelLoadError] = useState(false);

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
		if (downloadedAt && fileUri && !aiChat.isLoaded && !modelLoadError) {
			// Model is downloaded but not loaded yet, load it
			console.log("[Dashboard] Loading model from:", fileUri);
			aiChat
				.loadModel({ ggufPath: fileUri })
				.then(() => {
					console.log("[Dashboard] Model loaded successfully");
					setModelLoadError(false);
				})
				.catch((error) => {
					console.error("[Dashboard] Failed to load model:", error);
					setModelLoadError(true);
				});
		}
	}, [downloadedAt, fileUri, aiChat, modelLoadError]);

	// Function to retry loading the model
	const retryLoadModel = () => {
		setModelLoadError(false);
	};

	return (
		<SafeAreaView style={{ flex: 1 }}>
			{/* Background gradient layer */}
			<View
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					flex: 1,
					display: "flex",
				}}
			>
				<Svg
					key={colorScheme}
					style={[
						{
							flex: 1,
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							height: Dimensions.get("window").height,
						},
					]}
					viewBox={`0 0 1 ${Dimensions.get("window").height / Dimensions.get("window").width}`}
				>
					<Defs>
						<RadialGradient
							id="radialGradient"
							gradientUnits="objectBoundingBox"
							cx={0.5}
							cy={0.5}
							r={0.75}
						>
							<Stop offset="0" stopColor={"#ff5b91ff"} stopOpacity={0.1} />
							<Stop offset="0.15" stopColor={"#ff5b91ff"} stopOpacity={0.1} />
							<Stop offset="0.2" stopColor={"#ff95ffff"} stopOpacity={0.05} />
							<Stop offset="0.25" stopColor={"#69b7ffff"} stopOpacity={0.025} />
							<Stop offset="0.3" stopColor={theme.card} stopOpacity={0} />
							<Stop offset="0.4" stopColor={theme.background} stopOpacity={1} />
						</RadialGradient>
					</Defs>
					<Rect
						x={-1.5}
						y={0.125}
						width="4"
						height="4"
						fill="url(#radialGradient)"
					/>
				</Svg>

				<ImageBackground
					source={
						colorScheme === "dark"
							? require(`../assets/images/grain-dark.png`)
							: require(`../assets/images/grain.png`)
					}
					style={{
						flex: 1,
						opacity: 0.2,
						backgroundColor: backgroundColor,
					}}
				/>
			</View>

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
					onPress={() => router.push("/settings")}
					variant="ghost"
					size="icon"
					style={{ backgroundColor: theme.accent }}
				>
					<Settings color={theme.textMuted} strokeWidth={2} size={20} />
				</Button>
			</View>

			{modelLoadError && <ModelLoadError onRetry={retryLoadModel} />}

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
