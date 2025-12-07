import { ChatBackground } from "@/components/chat-background";
import { SuggestionCards } from "@/components/suggestion-cards";
import { BottomSheet, useBottomSheet } from "@/components/ui/bottom-sheet";
import { Icon } from "@/components/ui/icon";
import { SearchButton } from "@/components/ui/searchbutton";
import { View } from "@/components/ui/view";
import { useChatCompletion } from "@/hooks/useChatCompletion";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useChatRenderers } from "@/hooks/useChatRenderers";
import { useChatState } from "@/hooks/useChatState";
import { useColor } from "@/hooks/useColor";
import { MessageCircle } from "lucide-react-native";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { Dimensions } from "react-native";
import { GiftedChat, type IMessage } from "react-native-gifted-chat";
import { ChatHeader } from "./chat-header";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ChatProps {
	children?: ReactNode;
	chatId?: string;
	isOpen?: boolean;
	onClose?: () => void;
}

export default function Chat({
	children,
	chatId: initialChatId,
	isOpen,
	onClose: onCloseCallback,
}: ChatProps) {
	const muted = useColor("textMuted");
	const { isVisible, open, close } = useBottomSheet();

	const [, setIsInputFocused] = useState(false);
	const [inputText, setInputText] = useState("");

	const handleClose = useCallback(() => {
		close();
		onCloseCallback?.();
	}, [close, onCloseCallback]);

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
		handleNewChat,
	} = useChatState({
		initialChatId,
		onClose: handleClose,
	});

	// Messages from TinyBase
	const messages = useChatMessages(currentChatId);

	// AI completion orchestration
	const { isAiTyping, streamingText, sendMessage } = useChatCompletion({
		chatId: currentChatId,
		messages,
		onChatCreated: setCurrentChatId,
	});

	// GiftedChat render functions
	const {
		defaultContainerStyle,
		renderBubble,
		renderInputToolbar,
		InputToolbar,
	} = useChatRenderers({
		setIsInputFocused,
		isTyping: isAiTyping,
		isNewChat: !currentChatId,
	});

	// Open bottom sheet when isOpen prop changes to true
	useEffect(() => {
		if (isOpen && !isVisible) {
			open();
		}
	}, [isOpen, isVisible, open]);

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
		<>
			{children ? (
				children
			) : (
				<SearchButton
					label="Chat..."
					leftIcon={<Icon name={MessageCircle} size={16} color={muted} />}
					loading={false}
					onPress={(event) => {
						event.preventDefault();
						open();
					}}
				/>
			)}

			<BottomSheet
				isVisible={isVisible}
				onClose={handleClose}
				snapPoints={[0.9]}
				enableBackdropDismiss
				disableKeyboardHandling
				style={{ flex: 1 }}
			>
				<ChatBackground>
					<View style={{ flex: 1 }}>
						<ChatHeader
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

						<View
							style={{
								flex: 1,
								marginTop: -4,
							}}
						>
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
				</ChatBackground>
				<InputToolbar
					text={inputText}
					onChangeText={setInputText}
					onSend={() => {
						if (inputText.trim()) {
							onSend([{ text: inputText.trim() } as IMessage]);
						}
					}}
				/>
			</BottomSheet>
		</>
	);
}
