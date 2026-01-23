import * as Haptics from "expo-haptics";
import { FolderInput, Pencil, Share2, Trash2 } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform, Pressable, TouchableOpacity } from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { useColorScheme } from "@/hooks/useColorScheme";
import { deleteChat, renameChat, shareChat } from "@/src/actions/chat";
import { formatChatPreviewDate } from "@/src/utils/format-date";
import { Colors } from "@/theme/colors";
import { Card, CardContent } from "./ui/card";
import { PromptDialog } from "./ui/prompt-dialog";
import { Text } from "./ui/text";
import { View } from "./ui/view";

export function ChatPreview({
	chatId,
	name,
	text,
	date,
	onPress,
	onDelete,
	onMoveToFolder,
	peekOnMount = false,
}: {
	chatId: string;
	name: string;
	text: string;
	date: Date;
	onPress?: () => void;
	onDelete?: () => void;
	onMoveToFolder?: () => void;
	peekOnMount?: boolean;
}) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const swipeableRef = useRef<Swipeable>(null);
	const [hasTriggeredHaptic, setHasTriggeredHaptic] = useState(false);
	const pressStartPosition = useRef<{ x: number; y: number } | null>(null);
	const [renamePromptVisible, setRenamePromptVisible] = useState(false);

	useEffect(() => {
		if (peekOnMount && swipeableRef.current && Platform.OS === "ios") {
			// Small delay to ensure component is fully mounted
			const timer = setTimeout(() => {
				// Open to 50% width to show a peek
				swipeableRef.current?.openRight();
				// Auto-close after showing the peek
				const closeTimer = setTimeout(() => {
					swipeableRef.current?.close();
				}, 700);
				return () => clearTimeout(closeTimer);
			}, 0);
			return () => clearTimeout(timer);
		}
	}, [peekOnMount]);

	const handlePressIn = (event: { nativeEvent: { pageX: number; pageY: number } }) => {
		pressStartPosition.current = {
			x: event.nativeEvent.pageX,
			y: event.nativeEvent.pageY,
		};
	};

	const handlePress = (event: { nativeEvent: { pageX: number; pageY: number } }) => {
		// Check if this was a tap or a swipe
		if (pressStartPosition.current) {
			const deltaX = Math.abs(
				event.nativeEvent.pageX - pressStartPosition.current.x,
			);
			const deltaY = Math.abs(
				event.nativeEvent.pageY - pressStartPosition.current.y,
			);

			// If moved more than 10px horizontally, consider it a swipe, not a tap
			if (deltaX > 10 || deltaY > 10) {
				pressStartPosition.current = null;
				return;
			}
		}

		if (process.env.EXPO_OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		}
		onPress?.();
		pressStartPosition.current = null;
	};

	const handleShareChat = async () => {
		swipeableRef.current?.close();
		try {
			await shareChat(chatId);
		} catch (error) {
			console.error("[handleShareChat] Error:", error);
			Alert.alert(
				"Share Failed",
				"Could not share the chat. Please try again.",
				[{ text: "OK" }],
			);
		}
	};

	const handleRenameChat = () => {
		swipeableRef.current?.close();
		setRenamePromptVisible(true);
	};

	const handleConfirmRename = (newName: string) => {
		if (newName.trim()) {
			renameChat(chatId, newName.trim());
			if (Platform.OS === "ios") {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
			}
		}
		setRenamePromptVisible(false);
	};

	const handleDeleteChat = () => {
		swipeableRef.current?.close();
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
						deleteChat(chatId);
						onDelete?.();
					},
				},
			],
		);
	};

	const handleMoveToFolder = () => {
		swipeableRef.current?.close();
		onMoveToFolder?.();
	};

	const renderRightActions = () => {
		return (
			<View
				style={{
					flexDirection: "row",
					alignItems: "stretch",
				}}
			>
				<TouchableOpacity
					onPress={handleMoveToFolder}
					style={{
						width: 56,
						justifyContent: "center",
						alignItems: "center",
					}}
					activeOpacity={0.8}
				>
					<FolderInput size={22} color={theme.primary} strokeWidth={2} />
					<Text
						style={{
							color: theme.primary,
							fontSize: 10,
							fontWeight: "400",
							marginTop: 4,
						}}
					>
						Move
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					onPress={handleShareChat}
					style={{
						width: 56,
						justifyContent: "center",
						alignItems: "center",
					}}
					activeOpacity={0.8}
				>
					<Share2 size={22} color={theme.textMuted} strokeWidth={2} />
					<Text
						style={{
							color: theme.textMuted,
							fontSize: 10,
							fontWeight: "400",
							marginTop: 4,
						}}
					>
						Share
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					onPress={handleRenameChat}
					style={{
						width: 56,
						justifyContent: "center",
						alignItems: "center",
					}}
					activeOpacity={0.8}
				>
					<Pencil size={22} color={theme.blue} strokeWidth={2} />
					<Text
						style={{
							color: theme.blue,
							fontSize: 10,
							fontWeight: "400",
							marginTop: 4,
						}}
					>
						Rename
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					onPress={handleDeleteChat}
					style={{
						width: 56,
						justifyContent: "center",
						alignItems: "center",

						borderTopRightRadius: 12,
						borderBottomRightRadius: 12,
					}}
					activeOpacity={0.8}
				>
					<Trash2 size={22} color="#ef4444" strokeWidth={2} />
					<Text
						style={{
							color: "#ef4444",
							fontSize: 10,
							fontWeight: "400",
							marginTop: 4,
						}}
					>
						Delete
					</Text>
				</TouchableOpacity>
			</View>
		);
	};

	const cardContent = (
		<Card>
			<CardContent>
				<View
					style={{
						display: "flex",
						flexDirection: "row",
						justifyContent: "space-between",
						width: "100%",
						gap: 12,
					}}
				>
					<Text
						style={{
							fontSize: 16,
							fontWeight: "400",
							textTransform: "capitalize",
							flex: 1,
						}}
						numberOfLines={1}
						ellipsizeMode="tail"
					>
						{name}
					</Text>
					<Text style={{ fontSize: 12, opacity: 0.5, flexShrink: 0 }}>
						{formatChatPreviewDate(date)}
					</Text>
				</View>
				<Text
					numberOfLines={1}
					style={{ opacity: 0.5, fontSize: 14, paddingTop: 4 }}
				>
					{text}
				</Text>
			</CardContent>
		</Card>
	);

	const handleSwipeableWillOpen = () => {
		if (process.env.EXPO_OS === "ios" && !hasTriggeredHaptic) {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
			setHasTriggeredHaptic(true);
		}
	};

	const handleSwipeableOpen = () => {
		if (process.env.EXPO_OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		}
	};

	const handleSwipeableClose = () => {
		setHasTriggeredHaptic(false);
	};

	const renameDialog = (
		<PromptDialog
			visible={renamePromptVisible}
			title="Rename Chat"
			message="Enter a new name for this chat"
			placeholder="Chat name"
			defaultValue={name}
			confirmText="Rename"
			onConfirm={handleConfirmRename}
			onCancel={() => setRenamePromptVisible(false)}
		/>
	);

	// Only use Swipeable on iOS
	if (Platform.OS === "ios") {
		return (
			<>
				<Swipeable
					ref={swipeableRef}
					renderRightActions={renderRightActions}
					overshootRight={false}
					friction={2}
					rightThreshold={40}
					onSwipeableOpenStartDrag={handleSwipeableWillOpen}
					onSwipeableWillOpen={handleSwipeableOpen}
					onSwipeableClose={handleSwipeableClose}
				>
					<Pressable onPressIn={handlePressIn} onPress={handlePress}>
						{cardContent}
					</Pressable>
				</Swipeable>
				{renameDialog}
			</>
		);
	}

	// For non-iOS platforms, just render the pressable card
	return (
		<>
			<Pressable onPressIn={handlePressIn} onPress={handlePress}>
				{cardContent}
			</Pressable>
			{renameDialog}
		</>
	);
}
