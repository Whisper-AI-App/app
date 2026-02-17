import { ChatBackground } from "@/components/chat-background";
import { ChatPageHeader } from "@/components/chat/chat-page-header";
import { MoveToFolderSheet } from "@/components/move-to-folder-sheet";
import { SuggestionCards } from "@/components/suggestion-cards";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIChat } from "@/contexts/AIChatContext";
import { useChatCompletion } from "@/hooks/useChatCompletion";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useChatRenderers } from "@/hooks/useChatRenderers";
import { useChatState } from "@/hooks/useChatState";
import { wouldTruncate } from "@/src/utils/context-window";
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

	// Get contextSize from AI context for truncation warning
	const { contextSize } = useAIChat();

	// Show warning when conversation will be truncated
	const showTruncationWarning = useMemo(() => {
		const totalChars = messages.reduce((sum, m) => sum + m.text.length, 0);
		return wouldTruncate(totalChars, contextSize);
	}, [messages, contextSize]);

	// AI completion orchestration
	const {
		isAiTyping,
		isContinuing,
		streamingText,
		sendMessage,
		stopGeneration,
		isCutOff,
		continueMessage,
		chatNotice,
		clearInferenceCache,
	} = useChatCompletion({
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
		isCutOff,
		onContinue: continueMessage ?? undefined,
		onStop: stopGeneration,
		chatNotice,
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

					{showTruncationWarning && (
						<View
							style={{
								padding: 8,
								backgroundColor: "rgba(255,200,0,0.2)",
							}}
						>
							<Text style={{ fontSize: 12, textAlign: "center" }}>
								Long chat - start a new one for best results.
							</Text>
						</View>
					)}

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
								// Streaming message (when AI has started responding, but NOT continuing)
								...(isAiTyping && streamingText && !isContinuing
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
								// Cutoff notice with continue button
								...(isCutOff && !isAiTyping
									? [
											{
												_id: "cutoff-notice",
												text: "",
												user: {
													_id: 2,
													name: "AI",
												},
											} as IMessage,
										]
									: []),
								// Chat notice (error or warning)
								...(chatNotice && !isAiTyping
									? [
											{
												_id: "chat-notice",
												text: chatNotice.message,
												user: {
													_id: 2,
													name: "AI",
												},
											} as IMessage,
										]
									: []),
								// Regular messages (during continuation, append streaming text to first AI message)
								...messages.map(
									(message, index) =>
										({
											_id: message._id,
											text:
												isContinuing && streamingText && index === 0 && message.user._id === 2
													? `${message.text}\n\n${streamingText}`
													: message.text,
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
