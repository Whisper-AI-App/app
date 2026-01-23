import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColorScheme } from "@/hooks/useColorScheme";
import type { ChatActionsMenuProps } from "@/src/types/chat";
import { Colors } from "@/theme/colors";
import { FolderInput, Pencil, Share2, Trash2 } from "lucide-react-native";
import { TouchableOpacity } from "react-native";

/**
 * Popover menu for chat actions: Share, Rename, Delete
 */
export const ChatActionsMenu: React.FC<ChatActionsMenuProps> = ({
	isOpen,
	onOpenChange,
	onShare,
	onRename,
	onDelete,
	onMoveToFolder,
	trigger,
}) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	return (
		<Popover open={isOpen} onOpenChange={onOpenChange}>
			<PopoverTrigger asChild>{trigger}</PopoverTrigger>
			<PopoverContent side="bottom" align="end" style={{ minWidth: 200 }}>
				<View style={{ paddingVertical: 4 }}>
					<TouchableOpacity
						onPress={onShare}
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
						onPress={onRename}
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

					{onMoveToFolder && (
						<TouchableOpacity
							onPress={onMoveToFolder}
							style={{
								flexDirection: "row",
								alignItems: "center",
								paddingVertical: 12,
								paddingHorizontal: 16,
							}}
							activeOpacity={0.7}
						>
							<FolderInput
								size={18}
								color={theme.text}
								style={{ marginRight: 12 }}
							/>
							<Text>Move to Folder</Text>
						</TouchableOpacity>
					)}

					<Separator style={{ marginVertical: 8 }} />

					<TouchableOpacity
						onPress={onDelete}
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
	);
};
