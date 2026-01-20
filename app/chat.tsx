import { ChatBackground } from "@/components/chat-background";
import { ChatPageHeader } from "@/components/chat/chat-page-header";
import { SuggestionCards } from "@/components/suggestion-cards";
import { View } from "@/components/ui/view";
import { useChatCompletion } from "@/hooks/useChatCompletion";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useChatRenderers } from "@/hooks/useChatRenderers";
import { useChatState } from "@/hooks/useChatState";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { View as RNView } from "react-native";
import { GiftedChat, type IMessage } from "react-native-gifted-chat";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ChatPage() {
	const router = useRouter();
	const { id: chatIdParam, folderId: folderIdParam } = useLocalSearchParams<{
		id?: string;
		folderId?: string;
	}>();

	const [, setIsInputFocused] = useState(false);
	const [inputText, setInputText] = useState("");

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
	} = useChatState({
		initialChatId: chatIdParam,
		onClose: handleClose,
	});

	// Handle new chat - reset state without navigation animation
	const handleNewChat = useCallback(() => {
		handleNewChatState();
		router.setParams({ id: undefined });
	}, [handleNewChatState, router]);

	// Messages from TinyBase
	const messages = useChatMessages(currentChatId);

	// AI completion orchestration
	const { isAiTyping, streamingText, sendMessage } = useChatCompletion({
		chatId: currentChatId,
		messages,
		onChatCreated: setCurrentChatId,
		folderId: folderIdParam || null,
	});

	// GiftedChat render functions - with isFullPage=true
	const {
		defaultContainerStyle,
		renderBubble,
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

	const onSend = useCallback(
		async (newMessages: IMessage[] = []) => {
			if (newMessages.length === 0) return;
			const userMessage = newMessages[0];
			setInputText(""); // Clear input after sending
			await sendMessage(userMessage.text);
		},
		[sendMessage],
	);

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
							renderAvatar={null}
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
		</RNView>
	);
}
