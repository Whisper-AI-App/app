import type { IMessage } from "react-native-gifted-chat";

/**
 * Shared type definitions for chat feature
 */

export interface ChatNotice {
	type: "error" | "warning";
	message: string;
}

export interface CompletionResult {
	content: string;
	stopped_eos: boolean;
	stopped_limit: number;
	context_full: boolean;
	truncated: boolean;
	tokens_predicted: number;
	tokens_evaluated: number;
}

export interface ChatRenderersProps {
	setIsInputFocused: (focused: boolean) => void;
	isTyping?: boolean;
	isNewChat?: boolean;
	isCutOff?: boolean;
	onContinue?: () => void;
	chatNotice?: ChatNotice | null;
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
	isContinuing: boolean;
	streamingText: string;
	sendMessage: (text: string) => Promise<void>;
	isCutOff: boolean;
	lastAiMessageId: string | null;
	continueMessage: (() => Promise<void>) | null;
	chatNotice: ChatNotice | null;
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
