import {
	type ChatPreviewData,
	DashboardChatList,
	DashboardGreeting,
	UpdateBanner,
} from "@/components/dashboard";
import { FolderManagementSheet } from "@/components/folder-management-sheet";
import { FolderSelector } from "@/components/folder-selector";
import { GradientBackground } from "@/components/gradient-background";
import { ModelLoadError } from "@/components/model-load-error";
import { ModelUpdateNotification } from "@/components/model-update-notification";
import { MoveToFolderSheet } from "@/components/move-to-folder-sheet";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { SearchBar } from "@/components/ui/searchbar";
import { SearchButton } from "@/components/ui/searchbutton";
import { View } from "@/components/ui/view";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { useColor } from "@/hooks/useColor";
import { checkForModelUpdates } from "@/src/ai-providers/whisper-ai/model-config";
import type { ModelUpdateInfo } from "@/src/ai-providers/whisper-ai/model-config";
import { renameChat } from "@/src/actions/chat";
import { mainStore } from "@/src/stores/main/main-store";
import { Colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { MessageCircle, Settings } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { Platform, useColorScheme } from "react-native";
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
	useCell,
	useRowIds,
	useSortedRowIds,
	useTable,
} from "tinybase/ui-react";

export default function Dashboard() {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const scrollY = useSharedValue(0);

	const router = useRouter();
	const muted = useColor("textMuted");

	const [searchQuery, setSearchQuery] = useState("");
	const [updateNotificationVisible, setUpdateNotificationVisible] =
		useState(false);
	const [updateAvailable, setUpdateAvailable] = useState(false);
	const [updateInfo, setUpdateInfo] = useState<ModelUpdateInfo | null>(null);

	// Folder state
	const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
	const [folderManagementSheetOpen, setFolderManagementSheetOpen] =
		useState(false);
	const [managedFolderId, setManagedFolderId] = useState<string>("");
	const [moveToFolderSheetOpen, setMoveToFolderSheetOpen] = useState(false);
	const [movingChatId, setMovingChatId] = useState<string>("");

	// Rename state
	const [renamePromptVisible, setRenamePromptVisible] = useState(false);
	const [renamingChatId, setRenamingChatId] = useState<string>("");
	const [renamingChatName, setRenamingChatName] = useState<string>("");

	const { activeProvider, setupError } = useAIProvider();

	// Subscribe to whisper-ai provider state for update checks
	const configVersion = useCell(
		"aiProviders",
		"whisper-ai",
		"configVersion",
	) as string | undefined;
	const downloadedAt = useCell(
		"aiProviders",
		"whisper-ai",
		"downloadedAt",
	) as string | undefined;

	// Get all chat IDs sorted by creation date (newest first)
	const chatIds = useSortedRowIds("chats", "createdAt", true);

	// Get all message IDs to find latest message for each chat
	const messageIds = useRowIds("messages");

	// Subscribe to the entire chats and messages tables to trigger re-render when any data changes
	const chatsTable = useTable("chats");
	const messagesTable = useTable("messages");

	// Get folder data
	const folderIds = useSortedRowIds("folders", "createdAt", false);
	const foldersTable = useTable("folders");

	// Process folders with chat counts
	const foldersWithCounts = useMemo(() => {
		const folders = folderIds.map((folderId) => {
			const folder = foldersTable[folderId];
			const chatCount = Object.values(chatsTable).filter(
				(chat) => chat?.folderId === folderId,
			).length;
			return {
				id: folderId,
				name: String(folder?.name || "Untitled"),
				chatCount,
			};
		});
		return folders.sort((a, b) => b.chatCount - a.chatCount);
	}, [folderIds, foldersTable, chatsTable]);

	const totalChatCount = chatIds.length;

	// Create a map of chatId -> latest message for preview
	const chatPreviews = useMemo<ChatPreviewData[]>(() => {
		const allPreviews = chatIds.map((chatId) => {
			const chat = chatsTable[chatId];

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
				folderId: String(chat?.folderId || ""),
			};
		});

		let filteredPreviews = allPreviews;
		if (selectedFolderId !== null) {
			filteredPreviews = allPreviews.filter(
				(preview) => preview.folderId === selectedFolderId,
			);
		}

		const query = searchQuery.trim().toLowerCase();
		if (!query) {
			return filteredPreviews;
		}

		return filteredPreviews.filter((preview) => {
			const nameMatch = String(preview.name).toLowerCase().includes(query);
			const textMatch = String(preview.text).toLowerCase().includes(query);
			return nameMatch || textMatch;
		});
	}, [
		chatIds,
		messageIds,
		searchQuery,
		chatsTable,
		messagesTable,
		selectedFolderId,
	]);

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

	// Check for model updates (whisper-ai only) after provider is ready
	useEffect(() => {
		if (
			!downloadedAt ||
			!activeProvider?.isConfigured() ||
			!configVersion ||
			activeProvider.id !== "whisper-ai"
		) {
			return;
		}

		const checkForUpdates = async () => {
			try {
				const info = await checkForModelUpdates(mainStore as any);
				if (info.hasUpdate) {
					setUpdateInfo(info);
					setUpdateAvailable(true);
					setUpdateNotificationVisible(true);
				}
			} catch (error) {
				console.error("[Dashboard] Failed to check for updates:", error);
			}
		};

		const timeout = setTimeout(checkForUpdates, 2000);
		return () => clearTimeout(timeout);
	}, [downloadedAt, activeProvider, configVersion]);

	const showUpdateAlert = useMemo(() => {
		return updateAvailable && !updateNotificationVisible && updateInfo;
	}, [updateAvailable, updateNotificationVisible, updateInfo]);

	// Folder management handlers
	const handleLongPressFolder = (folderId: string) => {
		setManagedFolderId(folderId);
		setFolderManagementSheetOpen(true);
	};

	const handleFolderDeleted = () => {
		setSelectedFolderId(null);
	};

	const handleMoveToFolder = (chatId: string) => {
		setMovingChatId(chatId);
		setMoveToFolderSheetOpen(true);
	};

	// Rename handlers
	const handleRename = (chatId: string, currentName: string) => {
		setRenamingChatId(chatId);
		setRenamingChatName(currentName);
		setRenamePromptVisible(true);
	};

	const handleConfirmRename = (newName: string) => {
		if (newName.trim() && renamingChatId) {
			renameChat(renamingChatId, newName.trim());
			if (Platform.OS === "ios") {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
			}
		}
		setRenamePromptVisible(false);
		setRenamingChatId("");
		setRenamingChatName("");
	};

	const managedFolderName =
		foldersTable[managedFolderId]?.name?.toString() || "";

	const movingChatFolderId =
		chatsTable[movingChatId]?.folderId?.toString() || "";

	const navigateToNewChat = () => {
		if (selectedFolderId) {
			router.push(`/chat?folderId=${selectedFolderId}`);
		} else {
			router.push("/chat");
		}
	};

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

				{setupError && (
					<ModelLoadError onRetry={() => activeProvider?.setup()} />
				)}

				{showUpdateAlert && updateInfo && (
					<UpdateBanner
						updateInfo={updateInfo}
						onViewPress={() => setUpdateNotificationVisible(true)}
					/>
				)}

				{/* Folder Selector */}
				<FolderSelector
					folders={foldersWithCounts}
					totalChatCount={totalChatCount}
					selectedFolderId={selectedFolderId}
					onSelectFolder={setSelectedFolderId}
					onLongPressFolder={handleLongPressFolder}
				/>

				{chatPreviews.length > 0 && (
					<DashboardGreeting
						chatCount={chatPreviews.length}
						animatedStyle={greetingAnimatedStyle}
						showUpdateAlert={!!showUpdateAlert}
						folderSelectorOffset={56}
					/>
				)}

				<DashboardChatList
					chatPreviews={chatPreviews}
					searchQuery={searchQuery}
					scrollHandler={scrollHandler}
					onChatPress={(chatId) => router.push(`/chat?id=${chatId}`)}
					onStartConversation={navigateToNewChat}
					onMoveToFolder={handleMoveToFolder}
					onRename={handleRename}
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
							onPress={navigateToNewChat}
						/>
					</View>
				</View>

				{/* Folder Management Sheet */}
				<FolderManagementSheet
					open={folderManagementSheetOpen}
					onOpenChange={setFolderManagementSheetOpen}
					folderId={managedFolderId}
					folderName={managedFolderName}
					onFolderDeleted={handleFolderDeleted}
				/>

				{/* Move to Folder Sheet */}
				<MoveToFolderSheet
					open={moveToFolderSheetOpen}
					onOpenChange={setMoveToFolderSheetOpen}
					chatId={movingChatId}
					currentFolderId={movingChatFolderId}
					folders={foldersWithCounts}
					onMoved={() => {}}
					onSelectFolder={setSelectedFolderId}
				/>

				{/* Model Update Notification */}
				{updateInfo && (
					<ModelUpdateNotification
						isVisible={updateNotificationVisible}
						onClose={() => {
							setUpdateNotificationVisible(false);
							if (!updateInfo.requiresDownload) {
								setUpdateAvailable(false);
							}
						}}
						currentCard={updateInfo.currentCard}
						newCard={updateInfo.newCard}
						currentVersion={updateInfo.currentVersion ?? ""}
						newVersion={updateInfo.newVersion}
						requiresDownload={updateInfo.requiresDownload}
					/>
				)}

				{/* Rename Chat Dialog */}
				<PromptDialog
					visible={renamePromptVisible}
					title="Rename Chat"
					message="Enter a new name for this chat"
					placeholder="Chat name"
					defaultValue={renamingChatName}
					confirmText="Rename"
					onConfirm={handleConfirmRename}
					onCancel={() => {
						setRenamePromptVisible(false);
						setRenamingChatId("");
						setRenamingChatName("");
					}}
				/>
			</SafeAreaView>
		</View>
	);
}
