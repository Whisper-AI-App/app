import {
	type ChatPreviewData,
	DashboardChatList,
	DashboardGreeting,
	UpdateBanner,
} from "@/components/dashboard";
import { GradientBackground } from "@/components/gradient-background";
import { ModelLoadError } from "@/components/model-load-error";
import { ModelUpdateNotification } from "@/components/model-update-notification";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { SearchBar } from "@/components/ui/searchbar";
import { SearchButton } from "@/components/ui/searchbutton";
import { View } from "@/components/ui/view";
import { useAIChat } from "@/contexts/AIChatContext";
import { useColor } from "@/hooks/useColor";
import { checkForModelUpdates } from "@/src/actions/ai/model-config";
import type { ModelUpdateInfo } from "@/src/actions/ai/types";
import { getModelFileUri } from "@/src/stores/main/main-store";
import { Colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { MessageCircle, Settings } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import {
	Extrapolation,
	interpolate,
	useAnimatedScrollHandler,
	useAnimatedStyle,
	useSharedValue,
	withSpring,
} from "react-native-reanimated";
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
	const scrollY = useSharedValue(0);

	const router = useRouter();
	const muted = useColor("textMuted");

	const [searchQuery, setSearchQuery] = useState("");
	const [modelLoadError, setModelLoadError] = useState(false);
	const [updateNotificationVisible, setUpdateNotificationVisible] =
		useState(false);
	const [updateAvailable, setUpdateAvailable] = useState(false);
	const [updateInfo, setUpdateInfo] = useState<ModelUpdateInfo | null>(null);

	const aiChat = useAIChat();

	// Check for completed model using useValue
	const downloadedAt = useValue("ai_chat_model_downloadedAt") as
		| string
		| undefined;
	// Use filename (not full path) to detect changes, then reconstruct full path
	const filename = useValue("ai_chat_model_filename") as string | undefined;
	const storedConfigVersion = useValue("ai_chat_model_config_version") as
		| string
		| undefined;

	// Get all chat IDs sorted by creation date (newest first)
	const chatIds = useSortedRowIds("chats", "createdAt", true);

	// Get all message IDs to find latest message for each chat
	const messageIds = useRowIds("messages");

	// Subscribe to the entire chats and messages tables to trigger re-render when any data changes
	const chatsTable = useTable("chats");
	const messagesTable = useTable("messages");

	// Create a map of chatId -> latest message for preview
	const chatPreviews = useMemo<ChatPreviewData[]>(() => {
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
				name: String(chat?.name || "Untitled Chat"),
				text: String(latestMessage?.contents || "No messages yet"),
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
		if (downloadedAt && filename && !aiChat.isLoaded && !modelLoadError) {
			// Reconstruct full path from filename (handles app updates changing paths)
			const fileUri = getModelFileUri();
			if (!fileUri) return;

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
	}, [downloadedAt, filename, aiChat, modelLoadError]);

	// Function to retry loading the model
	const retryLoadModel = () => {
		setModelLoadError(false);
	};

	// Animated scroll handler
	const scrollHandler = useAnimatedScrollHandler({
		onScroll: (event) => {
			scrollY.value = event.contentOffset.y;
		},
	});

	// Greeting animation style
	const greetingAnimatedStyle = useAnimatedStyle(() => {
		const opacity = interpolate(
			scrollY.value,
			[0, 48],
			[1, 0],
			Extrapolation.CLAMP,
		);

		const targetTranslateY = interpolate(
			scrollY.value,
			[0, 48],
			[0, -32],
			Extrapolation.CLAMP,
		);

		return {
			opacity,
			transform: [
				{
					translateY: withSpring(targetTranslateY, {
						damping: 30,
						stiffness: 250,
						mass: 0.3,
						overshootClamping: false,
					}),
				},
			],
		};
	});

	// Check for model updates after model is loaded
	useEffect(() => {
		console.log("[Dashboard] Update check conditions:", {
			downloadedAt: !!downloadedAt,
			isLoaded: aiChat.isLoaded,
			storedConfigVersion,
		});

		if (!downloadedAt || !aiChat.isLoaded || !storedConfigVersion) {
			return;
		}

		const checkForUpdates = async () => {
			try {
				const updateInfo = await checkForModelUpdates();

				if (updateInfo.hasUpdate) {
					console.log(
						"[Dashboard] Update available:",
						updateInfo.requiresDownload ? "download required" : "metadata only",
						`(${updateInfo.reason})`,
					);
					setUpdateInfo(updateInfo);
					setUpdateAvailable(true);
					setUpdateNotificationVisible(true);
				} else {
					console.log("[Dashboard] No update available");
				}
			} catch (error) {
				console.error("[Dashboard] Failed to check for updates:", error);
			}
		};

		// Check for updates with a small delay to not interfere with model loading
		const timeout = setTimeout(checkForUpdates, 2000);
		return () => clearTimeout(timeout);
	}, [downloadedAt, aiChat.isLoaded, storedConfigVersion]);

	const showUpdateAlert = useMemo(() => {
		return updateAvailable && !updateNotificationVisible && updateInfo;
	}, [updateAvailable, updateNotificationVisible, updateInfo]);

	return (
		<View style={{ flex: 1 }}>
			<GradientBackground variant="animated" />

			<SafeAreaView edges={["right", "top", "left"]} style={{ flex: 1 }}>
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

				{showUpdateAlert && updateInfo && (
					<UpdateBanner
						updateInfo={updateInfo}
						onViewPress={() => setUpdateNotificationVisible(true)}
					/>
				)}

				{chatPreviews.length > 0 && (
					<DashboardGreeting
						chatCount={chatPreviews.length}
						animatedStyle={greetingAnimatedStyle}
						showUpdateAlert={!!showUpdateAlert}
					/>
				)}

				<DashboardChatList
					chatPreviews={chatPreviews}
					searchQuery={searchQuery}
					scrollHandler={scrollHandler}
					onChatPress={(chatId) => router.push(`/chat?id=${chatId}`)}
					onStartConversation={() => router.push("/chat")}
				/>

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
						<SearchButton
							label="Chat..."
							leftIcon={<Icon name={MessageCircle} size={16} color={muted} />}
							loading={false}
							onPress={() => {
								router.push("/chat");
							}}
						/>
					</View>
				</View>

				{/* Model Update Notification */}
				{updateInfo && (
					<ModelUpdateNotification
						isVisible={updateNotificationVisible}
						onClose={() => {
							setUpdateNotificationVisible(false);
							// If it's just metadata update, dismiss permanently
							if (!updateInfo.requiresDownload) {
								setUpdateAvailable(false);
							}
							// If download required, keep banner visible
						}}
						currentCard={updateInfo.currentCard}
						newCard={updateInfo.newCard}
						currentVersion={updateInfo.currentVersion ?? ""}
						newVersion={updateInfo.newVersion}
						requiresDownload={updateInfo.requiresDownload}
					/>
				)}
			</SafeAreaView>
		</View>
	);
}
