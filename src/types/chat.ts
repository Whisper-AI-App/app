import type { IMessage } from "react-native-gifted-chat";

/**
 * Shared type definitions for chat feature
 */

export interface ChatRenderersProps {
	setIsInputFocused: (focused: boolean) => void;
	isTyping?: boolean;
	isNewChat?: boolean;
}

export interface UseChatStateOptions {
	initialChatId?: string;
	onClose?: () => void;
}

export interface UseChatStateReturn {
	currentChatId: string | undefined;
	setCurrentChatId: (id: string | undefined) => void;
	chatRow: Record<string, unknown>;
	isMenuOpen: boolean;
	setIsMenuOpen: (open: boolean) => void;
	handleShareChat: () => Promise<void>;
	handleRenameChat: () => void;
	handleDeleteChat: () => void;
	handleNewChat: () => void;
	renamePromptVisible: boolean;
	setRenamePromptVisible: (visible: boolean) => void;
	handleConfirmRename: (newName: string) => void;
}

export interface UseChatCompletionOptions {
	chatId: string | undefined;
	messages: IMessage[];
	onChatCreated?: (newChatId: string) => void;
	folderId?: string | null;
}

export interface UseChatCompletionReturn {
	isAiTyping: boolean;
	streamingText: string;
	sendMessage: (text: string) => Promise<void>;
}

export interface ChatHeaderProps {
	chatName?: string;
	hasMessages: boolean;
	onClose: () => void;
	onNewChat: () => void;
	isMenuOpen: boolean;
	onMenuOpenChange: (open: boolean) => void;
	onShare: () => void;
	onRename: () => void;
	onDelete: () => void;
	onMoveToFolder?: () => void;
}

export interface ChatActionsMenuProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onShare: () => void;
	onRename: () => void;
	onDelete: () => void;
	onMoveToFolder?: () => void;
	trigger: React.ReactNode;
}
