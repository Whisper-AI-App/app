import type { IMessage } from "react-native-gifted-chat";

/**
 * Shared type definitions for chat feature
 */

export interface ChatMessage {
	_id: string;
	text: string;
	createdAt: Date;
	user: {
		_id: number;
		name: string;
	};
}

export interface ChatState {
	currentChatId: string | undefined;
	isAiTyping: boolean;
	streamingText: string;
	inputText: string;
	isMenuOpen: boolean;
	isInputFocused: boolean;
}

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
}

export interface ChatActionsMenuProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	onShare: () => void;
	onRename: () => void;
	onDelete: () => void;
	trigger: React.ReactNode;
}
