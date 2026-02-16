import { ChatBackground } from "@/components/chat-background";
import { ChatPageHeader } from "@/components/chat/chat-page-header";
import { MoveToFolderSheet } from "@/components/move-to-folder-sheet";
import { SuggestionCards } from "@/components/suggestion-cards";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { View } from "@/components/ui/view";
import { useChatCompletion } from "@/hooks/useChatCompletion";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useChatRenderers } from "@/hooks/useChatRenderers";
import { useChatState } from "@/hooks/useChatState";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { View as RNView } from "react-native";
import { GiftedChat, type IMessage } from "react-native-gifted-chat";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSortedRowIds, useTable } from "tinybase/ui-react";

export default function ChatPage() {
	const router = useRouter();
	const { id: chatIdParam, folderId: folderIdParam } = useLocalSearchParams<{
		id?: string;
		folderId?: string;
	}>();

	const [, setIsInputFocused] = useState(false);
	const [inputText, setInputText] = useState("");
	const [moveToFolderSheetOpen, setMoveToFolderSheetOpen] = useState(false);

	// Get folder data for move sheet
	const folderIds = useSortedRowIds("folders", "createdAt", false);
	const foldersTable = useTable("folders");
	const chatsTable = useTable("chats");

	const foldersWithCounts = useMemo(() => {
		return folderIds.map((folderId) => {
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
	}, [folderIds, foldersTable, chatsTable]);

	const handleClose = useCallback(() => {
		router.back();
	}, [router]);

	// Chat state management
	const {
		currentChatId,
		setCurrentChatId,
		chatRow,
		isMenuOpen,
		setIsMenuOpen,
		handleShareChat,
		handleRenameChat,
		handleDeleteChat,
		handleNewChat: handleNewChatState,
		renamePromptVisible,
		setRenamePromptVisible,
		handleConfirmRename,
	} = useChatState({
		initialChatId: chatIdParam,
		onClose: handleClose,
	});

	// Messages from TinyBase
	const messages = useChatMessages(currentChatId);

	// AI completion orchestration
	const { isAiTyping, streamingText, sendMessage, clearInferenceCache } =
		useChatCompletion({
			chatId: currentChatId,
			messages,
			onChatCreated: setCurrentChatId,
			folderId: folderIdParam || null,
		});

	// Handle new chat - reset state without navigation animation, and clear caches
	const handleNewChat = useCallback(() => {
		clearInferenceCache();
		handleNewChatState();
		router.setParams({ id: undefined });
	}, [handleNewChatState, clearInferenceCache, router]);

	// GiftedChat render functions - with isFullPage=true
	const {
		defaultContainerStyle,
		renderBubble,
		renderAvatar,
		renderInputToolbar,
		InputToolbar,
	} = useChatRenderers({
		setIsInputFocused,
		isTyping: isAiTyping,
		isNewChat: !currentChatId,
		isFullPage: true,
	});

	const handleSuggestionPress = useCallback((text: string) => {
		setInputText(text);
	}, []);

	const handleMoveToFolder = useCallback(() => {
		setIsMenuOpen(false);
		setMoveToFolderSheetOpen(true);
	}, [setIsMenuOpen]);

	// Get current chat's folder ID
	const currentChatFolderId = currentChatId
		? String(chatsTable[currentChatId]?.folderId || "")
		: "";

	const onSend = useCallback(
		async (newMessages: IMessage[] = []) => {
			if (newMessages.length === 0) return;
			const userMessage = newMessages[0];
			setInputText(""); // Clear input after sending
			await sendMessage(userMessage.text);
		},
		[sendMessage],
	);

	useEffect(() => {
		// Clear inference cache on chat load (i.e. switching conversations)
		clearInferenceCache();
	}, [clearInferenceCache, currentChatId]);

	return (
		<RNView style={{ flex: 1 }}>
			<ChatBackground asBackgroundLayer />
			<SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
				<View style={{ flex: 1 }}>
					<ChatPageHeader
						chatName={chatRow.name as string | undefined}
						hasMessages={messages.length > 0}
						onClose={handleClose}
						onNewChat={handleNewChat}
						isMenuOpen={isMenuOpen}
						onMenuOpenChange={setIsMenuOpen}
						onShare={handleShareChat}
						onRename={handleRenameChat}
						onDelete={handleDeleteChat}
						onMoveToFolder={currentChatId ? handleMoveToFolder : undefined}
					/>

					<View style={{ flex: 1 }}>
						{messages.length === 0 && !currentChatId && (
							<View
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									bottom: 60,
									zIndex: 0,
								}}
							>
								<SuggestionCards onSuggestionPress={handleSuggestionPress} />
							</View>
						)}
						<GiftedChat
							key={currentChatId || "new-chat"}
							messages={[
								// Typing indicator as a message (when AI typing but no text yet)
								...(isAiTyping && !streamingText
									? [
											{
												_id: "typing-indicator",
												text: "",
												user: {
													_id: 2,
													name: "AI",
												},
											} as IMessage,
										]
									: []),
								// Streaming message (when AI has started responding)
								...(isAiTyping && streamingText
									? [
											{
												_id: "streaming",
												text: streamingText,
												user: {
													_id: 2,
													name: "AI",
												},
											} as IMessage,
										]
									: []),
								// Regular messages
								...messages.map(
									(message) =>
										({
											_id: message._id,
											text: message.text,
											user: message.user,
										}) as IMessage,
								),
							]}
							onSend={(msgs) => onSend(msgs)}
							user={{
								_id: 1,
							}}
							renderAvatar={renderAvatar}
							renderAvatarOnTop
							alwaysShowSend
							isTyping={false}
							bottomOffset={0}
							minInputToolbarHeight={0}
							renderBubble={renderBubble}
							renderInputToolbar={renderInputToolbar}
							messagesContainerStyle={defaultContainerStyle}
							keyboardShouldPersistTaps="handled"
							inverted={true}
						/>
					</View>
				</View>
			</SafeAreaView>
			<InputToolbar
				text={inputText}
				onChangeText={setInputText}
				onSend={() => {
					if (inputText.trim()) {
						onSend([{ text: inputText.trim() } as IMessage]);
					}
				}}
			/>
			{currentChatId && (
				<MoveToFolderSheet
					open={moveToFolderSheetOpen}
					onOpenChange={setMoveToFolderSheetOpen}
					chatId={currentChatId}
					currentFolderId={currentChatFolderId}
					folders={foldersWithCounts}
					onMoved={() => {}}
				/>
			)}

			<PromptDialog
				visible={renamePromptVisible}
				title="Rename Chat"
				message="Enter a new name for this chat"
				placeholder="Chat name"
				defaultValue={chatRow.name as string}
				confirmText="Rename"
				onConfirm={handleConfirmRename}
				onCancel={() => setRenamePromptVisible(false)}
			/>
		</RNView>
	);
}
