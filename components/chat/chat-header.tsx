import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColorScheme } from "@/hooks/useColorScheme";
import type { ChatHeaderProps } from "@/src/types/chat";
import { Colors } from "@/theme/colors";
import { BlurView } from "expo-blur";
import { MoreHorizontal, SquarePen, X } from "lucide-react-native";
import { ChatActionsMenu } from "./chat-actions-menu";

/**
 * Chat header component with blur effect, title, and action buttons.
 * Includes close button, chat title, new chat button, and actions menu.
 */
export const ChatHeader: React.FC<ChatHeaderProps> = ({
	chatName,
	hasMessages,
	onClose,
	onNewChat,
	isMenuOpen,
	onMenuOpenChange,
	onShare,
	onRename,
	onDelete,
}) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	return (
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
						onPress={onClose}
					>
						<X color={theme.text} width={20} />
					</Button>
					{chatName && (
						<View style={{ marginRight: "auto" }}>
							<Text
								numberOfLines={2}
								style={{
									textAlign: "left",
									maxWidth: 150,
									fontSize: chatName.length > 30 ? 12 : 16,
								}}
							>
								{chatName}
							</Text>
						</View>
					)}
					<View style={{ flexDirection: "row", gap: 0 }}>
						{hasMessages && (
							<>
								<Button
									size="icon"
									variant="ghost"
									onPress={onNewChat}
								>
									<SquarePen color={theme.text} width={20} />
								</Button>
								<ChatActionsMenu
									isOpen={isMenuOpen}
									onOpenChange={onMenuOpenChange}
									onShare={onShare}
									onRename={onRename}
									onDelete={onDelete}
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
			</BlurView>
		</View>
	);
};
