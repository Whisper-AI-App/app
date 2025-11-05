import { useAIChat } from "@/contexts/AIChatContext";
import { useColor } from "@/hooks/useColor";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
	deleteChat,
	renameChat,
	shareChat,
	upsertChat,
} from "@/src/actions/chat";
import { upsertMessage } from "@/src/actions/message";
import { store } from "@/src/store";
import { Colors } from "@/theme/colors";
import { BlurView } from "expo-blur";
import {
	MessageCircle,
	MoreHorizontal,
	Pencil,
	SendHorizonal,
	Share2,
	SquarePen,
	Trash2,
	X,
} from "lucide-react-native";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	Alert,
	Animated,
	Dimensions,
	KeyboardAvoidingView,
	Platform,
	TouchableOpacity,
} from "react-native";
import { Bubble, GiftedChat, type IMessage } from "react-native-gifted-chat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRow, useRowIds } from "tinybase/ui-react";
import { v4 as uuidv4 } from "uuid";
import { SuggestionCards } from "./suggestion-cards";
import { BottomSheet, useBottomSheet } from "./ui/bottom-sheet";
import { Button } from "./ui/button";
import { Icon } from "./ui/icon";
import { Input } from "./ui/input";
import { Markdown } from "./ui/markdown";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { SearchButton } from "./ui/searchbutton";
import { Separator } from "./ui/separator";
import { Text } from "./ui/text";
import { View } from "./ui/view";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function Chat({
	children,
	chatId: initialChatId,
	isOpen,
	onClose: onCloseCallback,
}: {
	children?: ReactNode;
	chatId?: string;
	isOpen?: boolean;
	onClose?: () => void;
}) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const insets = useSafeAreaInsets();
	const { isVisible, open, close } = useBottomSheet();

	const handleClose = useCallback(() => {
		close();
		onCloseCallback?.();
	}, [close, onCloseCallback]);

	const muted = useColor("textMuted");
	const [isInputFocused, setIsInputFocused] = useState(false);
	const [isAiTyping, setIsAiTyping] = useState(false);
	const [streamingText, setStreamingText] = useState("");
	const [currentChatId, setCurrentChatId] = useState<string | undefined>(
		initialChatId,
	);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [inputText, setInputText] = useState("");
	const aiChat = useAIChat();

	// Reset currentChatId when initialChatId changes (e.g., when opening different chat)
	useEffect(() => {
		setCurrentChatId(initialChatId);
	}, [initialChatId]);

	// Open bottom sheet when isOpen prop changes to true
	useEffect(() => {
		if (isOpen && !isVisible) {
			open();
		}
	}, [isOpen, isVisible, open]);

	const handleSuggestionPress = useCallback((text: string) => {
		setInputText(text);
	}, []);

	const {
		defaultContainerStyle,
		renderBubble,
		renderFooter,
		renderInputToolbar,
	} = useCustomChatUI({
		isInputFocused,
		setIsInputFocused,
		isTyping: isAiTyping,
		isNewChat: !currentChatId,
		inputText,
		setInputText,
	});

	// Load chat data from TinyBase
	const chatRow = useRow("chats", currentChatId ?? "");

	// Get all message IDs and filter by chatId
	const allMessageIds = useRowIds("messages");

	// Transform TinyBase messages to GiftedChat format
	const messages = useMemo(() => {
		if (!currentChatId) return [];

		const chatMessages = allMessageIds
			.map((id) => {
				const msg = store.getRow("messages", id);
				if (msg?.chatId !== currentChatId) return null;

				return {
					_id: msg.id,
					text: msg.contents,
					createdAt: new Date(msg.createdAt),
					user: {
						_id: msg.role === "user" ? 1 : 2,
						name: msg.role === "user" ? "You" : "AI",
					},
				} as IMessage;
			})
			.filter(Boolean) as IMessage[];

		// Sort by date descending (GiftedChat expects newest first)
		return chatMessages.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		);
	}, [currentChatId, allMessageIds]);

	const handleShareChat = useCallback(async () => {
		if (currentChatId) {
			setIsMenuOpen(false);
			try {
				await shareChat(currentChatId);
			} catch (error) {
				console.error("[handleShareChat] Error:", error);
				Alert.alert(
					"Share Failed",
					"Could not share the chat. Please try again.",
					[{ text: "OK" }],
				);
			}
		}
	}, [currentChatId]);

	const handleRenameChat = useCallback(() => {
		if (currentChatId && chatRow) {
			setIsMenuOpen(false);
			Alert.prompt(
				"Rename Chat",
				"Enter a new name for this chat",
				[
					{
						text: "Cancel",
						style: "cancel",
					},
					{
						text: "Rename",
						onPress: (newName) => {
							if (newName && newName.trim()) {
								renameChat(currentChatId, newName.trim());
							}
						},
					},
				],
				"plain-text",
				chatRow.name as string,
			);
		}
	}, [currentChatId, chatRow]);

	const handleDeleteChat = useCallback(() => {
		if (currentChatId) {
			setIsMenuOpen(false);
			Alert.alert(
				"Delete Chat",
				"Are you sure you want to delete this chat? This action cannot be undone.",
				[
					{
						text: "Cancel",
						style: "cancel",
					},
					{
						text: "Delete",
						style: "destructive",
						onPress: () => {
							deleteChat(currentChatId);
							setCurrentChatId(undefined);
							handleClose(); // Close the chat modal
						},
					},
				],
			);
		}
	}, [currentChatId, handleClose]);

	const onSend = useCallback(
		async (newMessages: IMessage[] = []) => {
			if (newMessages.length === 0) return;

			const userMessage = newMessages[0];
			setInputText(""); // Clear input after sending
			let chatId = currentChatId;

			// Create new chat if this is the first message
			if (!chatId) {
				chatId = uuidv4();
				const chatName = userMessage.text.slice(0, 50); // Use first 50 chars as name
				upsertChat(chatId, chatName);
				setCurrentChatId(chatId);
			}

			// Save user message
			const userMessageId = uuidv4();
			upsertMessage(userMessageId, chatId, userMessage.text, "user");

			// Get AI response
			if (aiChat.isLoaded) {
				setIsAiTyping(true);
				setStreamingText(""); // Clear any previous streaming text

				try {
					// Prepare conversation history
					const conversationMessages = messages.map((msg) => ({
						role: msg.user._id === 1 ? "user" : ("system" as const),
						content: msg.text,
					}));

					// Add the new user message
					conversationMessages.unshift({
						role: "user" as const,
						content: userMessage.text,
					});

					// Reverse to chronological order for AI
					conversationMessages.reverse();

					let aiResponseText = "";

					// Stream AI completion
					const response = await aiChat.completion(
						conversationMessages,
						(token) => {
							aiResponseText += token;
							setStreamingText((prev) => prev + token);
						},
					);

					// Save AI response
					if (response) {
						const aiMessageId = uuidv4();
						upsertMessage(aiMessageId, chatId, aiResponseText, "system");
						setStreamingText(""); // Clear streaming text after saving
					}
				} catch (error) {
					console.error("[Chat] AI completion error:", error);
					setStreamingText(""); // Clear on error too
				} finally {
					setIsAiTyping(false);
				}
			}
		},
		[currentChatId, messages, aiChat],
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
				<View style={{ flex: 1, position: "relative" }}>
					<View
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							marginTop: -32,
							borderTopStartRadius: 20,
							borderTopEndRadius: 20,
							overflow: "hidden",
							zIndex: 2,
						}}
					>
						<BlurView
							intensity={100}
							style={{
								borderRadius: 20,
							}}
						>
							<View
								style={{
									width: "100%",
									paddingHorizontal: 16,
									paddingTop: 12,
									paddingBottom: 6,
									display: "flex",
									flexDirection: "row",
									justifyContent: "space-between",
									alignItems: "center",
									borderRadius: 20,
								}}
							>
								<Button
									size="icon"
									variant="ghost"
									onPress={() => {
										handleClose();
									}}
								>
									<X color={theme.text} width={20} />
								</Button>
								{chatRow.name && (
									<View>
										<Text
											numberOfLines={2}
											style={{
												textAlign: "center",
												maxWidth: 150,
												fontSize:
													(chatRow.name as string).length > 30 ? 12 : 16,
											}}
										>
											{chatRow.name}
										</Text>
									</View>
								)}
								<View style={{ flexDirection: "row", gap: 8 }}>
									{messages.length > 0 && (
										<>
											<Button
												size="icon"
												variant="ghost"
												onPress={() => {
													setCurrentChatId(undefined);
												}}
											>
												<SquarePen color={theme.text} width={20} />
											</Button>
											<Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
												<PopoverTrigger asChild>
													<Button size="icon" variant="ghost">
														<MoreHorizontal color={theme.text} width={20} />
													</Button>
												</PopoverTrigger>
												<PopoverContent
													side="bottom"
													align="end"
													style={{ minWidth: 200 }}
												>
													<View style={{ paddingVertical: 4 }}>
														<TouchableOpacity
															onPress={handleShareChat}
															style={{
																flexDirection: "row",
																alignItems: "center",
																paddingVertical: 12,
																paddingHorizontal: 16,
															}}
															activeOpacity={0.7}
														>
															<Share2
																size={18}
																color={theme.text}
																style={{ marginRight: 12 }}
															/>
															<Text>Share</Text>
														</TouchableOpacity>

														<TouchableOpacity
															onPress={handleRenameChat}
															style={{
																flexDirection: "row",
																alignItems: "center",
																paddingVertical: 12,
																paddingHorizontal: 16,
															}}
															activeOpacity={0.7}
														>
															<Pencil
																size={18}
																color={theme.text}
																style={{ marginRight: 12 }}
															/>
															<Text>Rename</Text>
														</TouchableOpacity>

														<Separator style={{ marginVertical: 8 }} />

														<TouchableOpacity
															onPress={handleDeleteChat}
															style={{
																flexDirection: "row",
																alignItems: "center",
																paddingVertical: 12,
																paddingHorizontal: 16,
															}}
															activeOpacity={0.7}
														>
															<Trash2
																size={18}
																color="#ef4444"
																style={{ marginRight: 12 }}
															/>
															<Text style={{ color: "#ef4444" }}>Delete</Text>
														</TouchableOpacity>
													</View>
												</PopoverContent>
											</Popover>
										</>
									)}
								</View>
							</View>
						</BlurView>
					</View>

					<View
						style={{
							height: SCREEN_HEIGHT * 0.9 - 50,
							zIndex: 1,
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
								// Add streaming message at the beginning (it will appear at bottom due to inverted)
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
							onSend={(messages) => onSend(messages)}
							user={{
								_id: 1,
							}}
							renderAvatar={null}
							alwaysShowSend
							isTyping={isAiTyping && !streamingText}
							bottomOffset={insets.bottom}
							minInputToolbarHeight={60}
							renderBubble={renderBubble}
							renderInputToolbar={renderInputToolbar}
							renderFooter={renderFooter}
							messagesContainerStyle={defaultContainerStyle}
							keyboardShouldPersistTaps="handled"
							inverted={true}
							text={inputText}
							onInputTextChanged={setInputText}
						/>
						{Platform.OS === "android" && (
							<KeyboardAvoidingView behavior="padding" />
						)}
					</View>
				</View>
			</BottomSheet>
		</>
	);
}

interface ChatUIProps {
	isInputFocused: boolean;
	setIsInputFocused: (focused: boolean) => void;
	isTyping?: boolean;
	isNewChat?: boolean;
	inputText: string;
	setInputText: (text: string) => void;
}

export const useCustomChatUI = ({
	isInputFocused,
	setIsInputFocused,
	isTyping = false,
	isNewChat = false,
	inputText,
	setInputText,
}: ChatUIProps) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const insets = useSafeAreaInsets();

	const renderBubble = useCallback(
		(props: any) => {
			const message = props.currentMessage;

			const marginTop = JSON.stringify(props.previousMessage) === "{}" ? 92 : 4;

			// Check if this is a system message (AI response) - user._id === 2
			const isSystemMessage = message?.user?._id === 2;

			return (
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
					renderMessageText={
						isSystemMessage
							? () => (
									<View style={{}}>
										<Markdown>{message.text}</Markdown>
									</View>
								)
							: undefined
					}
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
						paddingBottom: Platform.OS === "ios" ? insets.bottom : 16,
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
		[theme, isTyping, setIsInputFocused, insets, isNewChat],
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

export const StreamingIndicator: React.FC = () => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const pulseAnim = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		const animation = Animated.loop(
			Animated.sequence([
				Animated.timing(pulseAnim, {
					toValue: 0.3,
					duration: 800,
					useNativeDriver: true,
				}),
				Animated.timing(pulseAnim, {
					toValue: 1,
					duration: 800,
					useNativeDriver: true,
				}),
			]),
		);

		animation.start();

		return () => {
			animation.stop();
		};
	}, []);

	return (
		<Animated.View
			style={{
				marginLeft: 8,
				marginTop: -8,
				marginBottom: 8,
				opacity: pulseAnim,
			}}
		>
			<Text
				style={{
					fontSize: 11,
					color: theme.textMuted,
					fontStyle: "italic",
				}}
			>
				Generating...
			</Text>
		</Animated.View>
	);
};
