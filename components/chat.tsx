import { useColor } from "@/hooks/useColor";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import { MessageCircle, SendHorizonal } from "lucide-react-native";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import {
	Animated,
	Dimensions,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import { Bubble, GiftedChat, type IMessage } from "react-native-gifted-chat";
import { BottomSheet, useBottomSheet } from "./ui/bottom-sheet";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";
import { Input } from "./ui/input";
import { SearchButton } from "./ui/searchbutton";
import { View } from "./ui/view";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function Chat({ children }: { children?: ReactNode }) {
	const { isVisible, open, close } = useBottomSheet();
	const muted = useColor("textMuted");
	const [isInputFocused, setIsInputFocused] = useState(false);
	const isAiTyping = false;
	const {
		defaultContainerStyle,
		renderBubble,
		renderFooter,
		renderInputToolbar,
	} = useCustomChatUI({
		isInputFocused,
		setIsInputFocused,
		isTyping: isAiTyping,
	});

	const [messages, setMessages] = useState([]);

	const onSend = useCallback((messages = []) => {
		setMessages((previousMessages) =>
			GiftedChat.append(previousMessages, messages),
		);
	}, []);

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
				onClose={close}
				title="Chat"
				snapPoints={[0.9]}
				enableBackdropDismiss
				style={{ flex: 1 }}
			>
				<View style={{ height: SCREEN_HEIGHT * 0.9 - 128 }}>
					<GiftedChat
						messages={messages}
						onSend={(messages) => onSend(messages)}
						user={{
							_id: 1,
						}}
						renderAvatar={null}
						alwaysShowSend
						isTyping={isAiTyping}
						bottomOffset={0}
						minInputToolbarHeight={60}
						renderBubble={renderBubble}
						renderInputToolbar={renderInputToolbar}
						renderFooter={renderFooter}
						messagesContainerStyle={defaultContainerStyle}
						keyboardShouldPersistTaps="handled"
						inverted={true}
					/>
					{Platform.OS === "android" && (
						<KeyboardAvoidingView behavior="padding" />
					)}
				</View>
			</BottomSheet>
		</>
	);
}

interface ChatUIProps {
	isInputFocused: boolean;
	setIsInputFocused: (focused: boolean) => void;
	isTyping?: boolean;
}

export const useCustomChatUI = ({
	isInputFocused,
	setIsInputFocused,
	isTyping = false,
}: ChatUIProps) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const renderBubble = useCallback(
		(props: any) => {
			const message = props.currentMessage;

			return (
				<Bubble
					{...props}
					wrapperStyle={{
						left: {
							backgroundColor: theme.background,
							borderRadius: 16,
							marginBottom: 4,
							marginTop: 4,
							paddingVertical: 8,
							paddingRight: 4,
							paddingLeft: 4,
						},
						right: {
							backgroundColor: theme.tint,
							borderRadius: 16,
							marginBottom: 4,
							marginTop: 4,
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
							color: "#ffffff",
							marginLeft: 8,
							marginRight: 8,
						},
					}}
				/>
			);
		},
		[theme],
	);

	const renderInputToolbar = useCallback(
		(props: any) => {
			return (
				<View
					style={{
						paddingTop: 8,
						paddingBottom: Platform.OS === "ios" ? 24 : 16,
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
							inputStyle={{ paddingVertical: 12 }}
							autoFocus
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
		[theme, isTyping, setIsInputFocused],
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
};

interface TypingIndicatorProps {
	isTyping: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
	isTyping,
}) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const dot1Opacity = useRef(new Animated.Value(0)).current;
	const dot2Opacity = useRef(new Animated.Value(0)).current;
	const dot3Opacity = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (isTyping) {
			const animation = Animated.loop(
				Animated.sequence([
					// Dot 1
					Animated.timing(dot1Opacity, {
						toValue: 1,
						duration: 200,
						useNativeDriver: true,
					}),
					// Dot 2
					Animated.timing(dot2Opacity, {
						toValue: 1,
						duration: 200,
						useNativeDriver: true,
					}),
					// Dot 3
					Animated.timing(dot3Opacity, {
						toValue: 1,
						duration: 200,
						useNativeDriver: true,
					}),
					// Reset all dots
					Animated.parallel([
						Animated.timing(dot1Opacity, {
							toValue: 0,
							duration: 200,
							useNativeDriver: true,
						}),
						Animated.timing(dot2Opacity, {
							toValue: 0,
							duration: 200,
							useNativeDriver: true,
						}),
						Animated.timing(dot3Opacity, {
							toValue: 0,
							duration: 200,
							useNativeDriver: true,
						}),
					]),
				]),
			);

			animation.start();

			return () => {
				animation.stop();
			};
		}
	}, [isTyping]);

	if (!isTyping) return null;

	return (
		<View
			style={[
				{
					padding: 12,
					borderRadius: 16,
					marginLeft: 8,
					marginBottom: 8,
					maxWidth: 100,
				},
				{ backgroundColor: theme.background },
			]}
		>
			<View
				style={{
					flexDirection: "row",
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				{[dot1Opacity, dot2Opacity, dot3Opacity].map((opacity, index) => (
					<Animated.View
						key={index}
						style={[
							{ width: 6, height: 6, borderRadius: 3, marginHorizontal: 3 },
							{ backgroundColor: theme.text, opacity },
						]}
					/>
				))}
			</View>
		</View>
	);
};
