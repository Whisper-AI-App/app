import { CopyMessageButton } from "@/components/chat/copy-message-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useKeyboardHeight } from "@/hooks/useKeyboardHeight";
import type { ChatRenderersProps } from "@/src/types/chat";
import { Colors } from "@/theme/colors";
import { SendHorizonal } from "lucide-react-native";
import { useCallback, useEffect } from "react";
import { Dimensions } from "react-native";
import { Bubble } from "react-native-gifted-chat";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_BASE_BOTTOM = 32 + SCREEN_HEIGHT * 0.1;
const PAGE_BASE_BOTTOM = 32;

/**
 * Hook that returns render functions for GiftedChat.
 * Handles bubble styling, input toolbar, and footer rendering.
 */
export function useChatRenderers({
	setIsInputFocused,
	isTyping = false,
	isNewChat = false,
	isFullPage = false,
}: ChatRenderersProps & { isFullPage?: boolean }) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const { keyboardHeight, keyboardAnimationDuration } = useKeyboardHeight();

	const BASE_BOTTOM = isFullPage ? PAGE_BASE_BOTTOM : SHEET_BASE_BOTTOM;

	// Animated keyboard offset for smooth toolbar movement
	const keyboardOffset = useSharedValue(0);

	useEffect(() => {
		keyboardOffset.value = withTiming(keyboardHeight, {
			duration: keyboardAnimationDuration || 200,
		});
	}, [keyboardHeight, keyboardAnimationDuration]);

	const animatedToolbarStyle = useAnimatedStyle(() => ({
		bottom:
			BASE_BOTTOM +
			keyboardOffset.value +
			(keyboardOffset.value > BASE_BOTTOM ? -28 : 0),
	}));

	const renderBubble = useCallback(
		(props: React.ComponentProps<typeof Bubble>) => {
			const message = props.currentMessage;

			// Margins adjusted for full page vs bottom sheet context
			const firstMessageMarginTop = isFullPage ? 16 : 92;
			const lastMessageMarginBottom = isFullPage ? 124 : 300;

			// Render typing indicator for special message
			if (message._id === "typing-indicator") {
				const isLastMessage = JSON.stringify(props.nextMessage) === "{}";
				return (
					<View
						style={{
							marginBottom: isLastMessage ? lastMessageMarginBottom : 4,
						}}
					>
						<TypingIndicator isTyping={true} />
					</View>
				);
			}

			const marginTop =
				JSON.stringify(props.previousMessage) === "{}"
					? firstMessageMarginTop
					: 4;
			const isLastMessage = JSON.stringify(props.nextMessage) === "{}";
			const marginBottom = isLastMessage ? lastMessageMarginBottom : 4;

			// Check if this is a system message (AI response) - user._id === 2
			const isSystemMessage = message?.user?._id === 2;
			const isUserMessage = message?.user?._id === 1;
			const isStreaming = message._id === "streaming";
			const showCopyButton = (isSystemMessage || isUserMessage) && !isStreaming;

			return (
				<View>
					<Bubble
						{...props}
						wrapperStyle={{
							left: {
								backgroundColor: theme.card,
								borderRadius: 24,
								marginBottom,
								marginTop,
								paddingVertical: 8,
								paddingRight: 4,
								paddingLeft: 4,
							},
							right: {
								backgroundColor: theme.tint,
								borderRadius: 24,
								marginBottom,
								marginTop,
								paddingVertical: 8,
								paddingRight: 4,
								paddingLeft: 4,
							},
						}}
						textStyle={{
							left: {
								color: theme.text,
								marginLeft: 8,
								marginRight: 8,
							},
							right: {
								color: theme.background,
								marginLeft: 8,
								marginRight: 8,
							},
						}}
						renderMessageText={
							isSystemMessage
								? () => (
										<View style={{ flexShrink: 1, maxWidth: "100%" }}>
											<Markdown>{message.text}</Markdown>
											{showCopyButton && (
												<CopyMessageButton text={message.text} />
											)}
										</View>
									)
								: isUserMessage && showCopyButton
									? (messageTextProps: { currentMessage?: { text?: string } }) => (
											<View style={{ flexShrink: 1, maxWidth: "100%", paddingHorizontal: 12, paddingVertical: 4, alignItems: "flex-end" }}>
												<Text style={{ color: theme.background }}>{messageTextProps.currentMessage?.text}</Text>
												<CopyMessageButton text={message.text} variant="user" />
											</View>
										)
									: undefined
						}
					/>
				</View>
			);
		},
		[theme, colorScheme, isFullPage],
	);

	// Return null for GiftedChat's input toolbar - we render our own externally
	const renderInputToolbar = useCallback(() => null, []);

	// Return null - typing indicator is now rendered as a message in renderBubble
	const renderFooter = useCallback(() => null, []);

	// Standalone input toolbar component to be rendered outside GiftedChat
	const InputToolbar = useCallback(
		({
			text,
			onChangeText,
			onSend,
		}: {
			text: string;
			onChangeText: (text: string) => void;
			onSend: () => void;
		}) => {
			return (
				<Animated.View
					style={[
						{
							position: "absolute",
							left: 0,
							right: 0,
							zIndex: 100,
							paddingTop: 8,
							paddingBottom: process.env.EXPO_OS === "android" ? 32 : 8,
							paddingHorizontal: 8,
							flexDirection: "row",
							alignItems: "flex-end",
							opacity: isTyping ? 0.6 : 1,
							gap: 8,
						},
						animatedToolbarStyle,
					]}
				>
					<View style={{ flex: 1 }}>
						<Input
							key={`chat-input-${isTyping}`}
							variant="chat"
							accessible
							value={text}
							onChangeText={onChangeText}
							multiline={true}
							inputStyle={{}}
							autoFocus={isNewChat}
							onFocus={() => setIsInputFocused(true)}
							onBlur={() => setIsInputFocused(false)}
							editable={!isTyping}
							enablesReturnKeyAutomatically
							underlineColorAndroid="transparent"
							placeholder={isTyping ? "AI is typing..." : "Type a message..."}
						/>
					</View>

					<View>
						<Button
							variant="default"
							icon={SendHorizonal}
							disabled={!text || isTyping}
							onPress={onSend}
							size="icon"
						/>
					</View>
				</Animated.View>
			);
		},
		[isTyping, setIsInputFocused, isNewChat, animatedToolbarStyle],
	);

	const defaultContainerStyle = {
		paddingHorizontal: 8,
	};

	return {
		renderBubble,
		renderInputToolbar,
		renderFooter,
		defaultContainerStyle,
		InputToolbar,
	};
}
