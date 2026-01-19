import {
	deleteChat,
	renameChat,
	shareChat,
} from "@/src/actions/chat";
import type {
	UseChatStateOptions,
	UseChatStateReturn,
} from "@/src/types/chat";
import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useRow } from "tinybase/ui-react";

/**
 * Hook to manage chat state and CRUD operations.
 * Handles currentChatId, menu state, and chat actions (share, rename, delete).
 */
export function useChatState(options: UseChatStateOptions): UseChatStateReturn {
	const { initialChatId, onClose } = options;

	const [currentChatId, setCurrentChatId] = useState<string | undefined>(
		initialChatId,
	);
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	// Load chat data from TinyBase
	const chatRow = useRow("chats", currentChatId ?? "");

	// Reset currentChatId when initialChatId changes (e.g., when opening different chat)
	useEffect(() => {
		setCurrentChatId(initialChatId);
	}, [initialChatId]);

	const handleShareChat = useCallback(async () => {
		if (currentChatId) {
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

			setIsMenuOpen(false);
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
						onPress: (newName: string | undefined) => {
							if (newName?.trim()) {
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
							onClose?.();
						},
					},
				],
			);
		}
	}, [currentChatId, onClose]);

	const handleNewChat = useCallback(() => {
		setCurrentChatId(undefined);
	}, []);

	return {
		currentChatId,
		setCurrentChatId,
		chatRow,
		isMenuOpen,
		setIsMenuOpen,
		handleShareChat,
		handleRenameChat,
		handleDeleteChat,
		handleNewChat,
	};
}
