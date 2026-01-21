import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColorScheme } from "@/hooks/useColorScheme";
import type { ChatHeaderProps } from "@/src/types/chat";
import { Colors } from "@/theme/colors";
import { ChevronLeft, MoreHorizontal, SquarePen } from "lucide-react-native";
import { ChatActionsMenu } from "./chat-actions-menu";

/**
 * Chat page header component for full-page chat context.
 * Uses ChevronLeft back button instead of X close button.
 * Follows Settings page header pattern with centered title and border-bottom.
 */
export const ChatPageHeader: React.FC<ChatHeaderProps> = ({
	chatName,
	hasMessages,
	onClose,
	onNewChat,
	isMenuOpen,
	onMenuOpenChange,
	onShare,
	onRename,
	onDelete,
	onMoveToFolder,
}) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	return (
		<View
			style={{
				flexDirection: "row",
				alignItems: "center",
				padding: 16,
				borderBottomWidth: 1,
				borderBottomColor: "rgba(125,125,125,0.15)",
				position: "relative",
			}}
		>
			<Button onPress={onClose} variant="ghost" size="icon">
				<ChevronLeft color={theme.textMuted} strokeWidth={2} size={24} />
			</Button>

			{chatName && (
				<Text
					style={{
						fontSize: chatName.length > 30 ? 14 : 18,
						fontWeight: "600",
						position: "absolute",
						left: 56,
						right: 100,
						textAlign: "center",
						paddingLeft: 16,
						paddingRight: 24,
					}}
					numberOfLines={2}
				>
					{chatName}
				</Text>
			)}

			<View style={{ marginLeft: "auto", flexDirection: "row", gap: 0 }}>
				{hasMessages && (
					<>
						<Button size="icon" variant="ghost" onPress={onNewChat}>
							<SquarePen color={theme.text} width={20} />
						</Button>
						<ChatActionsMenu
							isOpen={isMenuOpen}
							onOpenChange={onMenuOpenChange}
							onShare={onShare}
							onRename={onRename}
							onDelete={onDelete}
							onMoveToFolder={onMoveToFolder}
							trigger={
								<Button size="icon" variant="ghost">
									<MoreHorizontal color={theme.text} width={20} />
								</Button>
							}
						/>
					</>
				)}
			</View>
		</View>
	);
};
