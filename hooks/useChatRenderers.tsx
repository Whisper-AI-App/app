import { CopyMessageButton } from "@/components/chat/copy-message-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Markdown } from "@/components/ui/markdown";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { View } from "@/components/ui/view";
import { useColorScheme } from "@/hooks/useColorScheme";
import type { ChatRenderersProps } from "@/src/types/chat";
import { Colors } from "@/theme/colors";
import { SendHorizonal } from "lucide-react-native";
import { useCallback } from "react";
import type { IMessage } from "react-native-gifted-chat";
import { Bubble } from "react-native-gifted-chat";

/**
 * Hook that returns render functions for GiftedChat.
 * Handles bubble styling, input toolbar, and footer rendering.
 */
export function useChatRenderers({
	setIsInputFocused,
	isTyping = false,
	isNewChat = false,
}: ChatRenderersProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const renderBubble = useCallback(
		(props: any) => {
			const message = props.currentMessage;

			const marginTop = JSON.stringify(props.previousMessage) === "{}" ? 92 : 4;

			// Check if this is a system message (AI response) - user._id === 2
			const isSystemMessage = message?.user?._id === 2;
			const isStreaming = message._id === "streaming";
			const showCopyButton = isSystemMessage && !isStreaming;

			return (
				<View>
					<Bubble
						{...props}
						wrapperStyle={{
							left: {
								backgroundColor: theme.background,
								borderRadius: 24,
								marginBottom: 4,
								marginTop,
								paddingVertical: 8,
								paddingRight: 4,
								paddingLeft: 4,
							},
							right: {
								backgroundColor: theme.tint,
								borderRadius: 24,
								marginBottom: 4,
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
						textProps={{
							selectable: true,
							selectionColor:
								colorScheme === "dark"
									? "rgba(255, 255, 255, 0.3)"
									: "rgba(0, 0, 0, 0.2)",
						}}
						renderMessageText={
							isSystemMessage
								? () => (
										<View style={{ flexShrink: 1, maxWidth: "100%" }}>
											<Markdown>{message.text}</Markdown>
											{showCopyButton && <CopyMessageButton text={message.text} />}
										</View>
									)
								: undefined
						}
					/>
				</View>
			);
		},
		[theme, colorScheme],
	);

	const renderInputToolbar = useCallback(
		(props: any) => {
			return (
				<View
					style={{
						paddingTop: 8,
						paddingBottom: 0,
						minHeight: 60,
						flexDirection: "row",
						alignItems: "flex-end",
						paddingHorizontal: 8,
						opacity: isTyping ? 0.6 : 1,
						gap: 8,
					}}
				>
					<View style={{ flex: 1 }}>
						<Input
							variant="outline"
							accessible
							value={props.text}
							onChangeText={props.onTextChanged}
							multiline={true}
							inputStyle={
								{
									// paddingVertical: 12,
								}
							}
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
							disabled={!props.text || isTyping}
							onPress={() => {
								props.onSend(
									{ text: props.text.trim() } as Partial<IMessage>,
									true,
								);
							}}
							size="icon"
						></Button>
					</View>
				</View>
			);
		},
		[isTyping, setIsInputFocused, isNewChat],
	);

	const renderFooter = useCallback(() => {
		return <TypingIndicator isTyping={isTyping} />;
	}, [isTyping]);

	const defaultContainerStyle = {
		paddingHorizontal: 8,
		paddingBottom: 16,
	};

	return {
		renderBubble,
		renderInputToolbar,
		renderFooter,
		defaultContainerStyle,
	};
}
