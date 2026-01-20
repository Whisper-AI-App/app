import * as Haptics from "expo-haptics";
import { Pencil, Trash2 } from "lucide-react-native";
import { Alert, Platform, TouchableOpacity } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { deleteFolder, renameFolder } from "@/src/actions/folder";
import { Colors } from "@/theme/colors";
import { BORDER_RADIUS } from "@/theme/globals";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "./ui/sheet";
import { Text } from "./ui/text";
import { View } from "./ui/view";

interface FolderManagementSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	folderId: string;
	folderName: string;
	onFolderDeleted: () => void;
}

export function FolderManagementSheet({
	open,
	onOpenChange,
	folderId,
	folderName,
	onFolderDeleted,
}: FolderManagementSheetProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const handleRenameFolder = () => {
		onOpenChange(false);
		setTimeout(() => {
			Alert.prompt(
				"Rename Folder",
				"Enter a new name for this folder",
				[
					{
						text: "Cancel",
						style: "cancel",
					},
					{
						text: "Rename",
						onPress: (newName: string | undefined) => {
							if (newName?.trim()) {
								renameFolder(folderId, newName.trim());
								if (Platform.OS === "ios") {
									Haptics.notificationAsync(
										Haptics.NotificationFeedbackType.Success,
									);
								}
							}
						},
					},
				],
				"plain-text",
				folderName,
			);
		}, 300);
	};

	const handleDeleteFolder = () => {
		onOpenChange(false);
		setTimeout(() => {
			Alert.alert(
				"Delete Folder",
				`Are you sure you want to delete "${folderName}"? Chats in this folder will be moved to "All Chats".`,
				[
					{
						text: "Cancel",
						style: "cancel",
					},
					{
						text: "Delete",
						style: "destructive",
						onPress: () => {
							deleteFolder(folderId);
							if (Platform.OS === "ios") {
								Haptics.notificationAsync(
									Haptics.NotificationFeedbackType.Success,
								);
							}
							onFolderDeleted();
						},
					},
				],
			);
		}, 300);
	};

	const renderActionButton = (
		label: string,
		icon: React.ReactNode,
		color: string,
		onPress: () => void,
	) => (
		<TouchableOpacity
			onPress={onPress}
			activeOpacity={0.7}
			style={{
				flexDirection: "row",
				alignItems: "center",
				paddingVertical: 16,
				paddingHorizontal: 20,
				backgroundColor: theme.card,
				borderRadius: BORDER_RADIUS,
				gap: 14,
			}}
		>
			{icon}
			<Text style={{ fontSize: 17, color, fontWeight: "500" }}>{label}</Text>
		</TouchableOpacity>
	);

	return (
		<Sheet open={open} onOpenChange={onOpenChange} side="right">
			<SheetContent>
				<SheetHeader>
					<SheetTitle>{folderName}</SheetTitle>
					<SheetDescription>Manage this folder</SheetDescription>
				</SheetHeader>

				<View style={{ paddingHorizontal: 24, gap: 12, paddingTop: 8 }}>
					{renderActionButton(
						"Rename Folder",
						<Pencil size={22} color={theme.text} strokeWidth={2} />,
						theme.text,
						handleRenameFolder,
					)}

					{renderActionButton(
						"Delete Folder",
						<Trash2 size={22} color={theme.red} strokeWidth={2} />,
						theme.red,
						handleDeleteFolder,
					)}
				</View>
			</SheetContent>
		</Sheet>
	);
}
