import * as Haptics from "expo-haptics";
import { Check, Folder, FolderMinus, FolderPlus } from "lucide-react-native";
import { Alert, Platform, ScrollView, TouchableOpacity } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { moveChatToFolder } from "@/src/actions/chat";
import { createFolder } from "@/src/actions/folder";
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

interface MoveToFolderSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	chatId: string;
	currentFolderId: string;
	folders: Array<{ id: string; name: string }>;
	onMoved: () => void;
	onSelectFolder?: (folderId: string | null) => void;
}

export function MoveToFolderSheet({
	open,
	onOpenChange,
	chatId,
	currentFolderId,
	folders,
	onMoved,
	onSelectFolder,
}: MoveToFolderSheetProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const handleMoveToFolder = (folderId: string | null) => {
		moveChatToFolder(chatId, folderId);
		if (Platform.OS === "ios") {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		}
		onOpenChange(false);
		onMoved();
	};

	const handleCreateNewFolder = () => {
		onOpenChange(false);
		setTimeout(() => {
			Alert.prompt(
				"New Folder",
				"Enter a name for the folder",
				[
					{
						text: "Cancel",
						style: "cancel",
					},
					{
						text: "Create & Move",
						onPress: (folderName: string | undefined) => {
							if (folderName?.trim()) {
								const newFolderId = createFolder(folderName.trim());
								moveChatToFolder(chatId, newFolderId);
								if (Platform.OS === "ios") {
									Haptics.notificationAsync(
										Haptics.NotificationFeedbackType.Success,
									);
								}
								onSelectFolder?.(newFolderId);
								onMoved();
							}
						},
					},
				],
				"plain-text",
				"",
			);
		}, 300);
	};

	const isInFolder = currentFolderId && currentFolderId !== "";

	const renderFolderOption = (
		label: string,
		folderId: string | null,
		icon: React.ReactNode,
		isSelected: boolean,
	) => (
		<TouchableOpacity
			key={folderId ?? "unfiled"}
			onPress={() => handleMoveToFolder(folderId)}
			activeOpacity={0.7}
			style={{
				flexDirection: "row",
				alignItems: "center",
				paddingVertical: 16,
				paddingHorizontal: 20,
				backgroundColor: isSelected ? theme.accent : theme.card,
				borderRadius: BORDER_RADIUS,
				gap: 14,
			}}
		>
			{icon}
			<Text
				style={{
					flex: 1,
					fontSize: 17,
					fontWeight: isSelected ? "600" : "400",
					color: theme.text,
				}}
			>
				{label}
			</Text>
			{isSelected && <Check size={20} color={theme.primary} strokeWidth={2.5} />}
		</TouchableOpacity>
	);

	return (
		<Sheet open={open} onOpenChange={onOpenChange} side="right">
			<SheetContent>
				<SheetHeader>
					<SheetTitle>Move to Folder</SheetTitle>
					<SheetDescription>Choose a folder for this chat</SheetDescription>
				</SheetHeader>

				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={{ paddingHorizontal: 24, gap: 12, paddingTop: 8, paddingBottom: 40 }}
					showsVerticalScrollIndicator={false}
				>
					{isInFolder &&
						renderFolderOption(
							"Remove from folder",
							null,
							<FolderMinus size={22} color={theme.textMuted} strokeWidth={2} />,
							false,
						)}

					{folders.map((folder) =>
						renderFolderOption(
							folder.name,
							folder.id,
							<Folder size={22} color={theme.primary} strokeWidth={2} />,
							folder.id === currentFolderId,
						),
					)}

					<TouchableOpacity
						onPress={handleCreateNewFolder}
						activeOpacity={0.7}
						style={{
							flexDirection: "row",
							alignItems: "center",
							paddingVertical: 16,
							paddingHorizontal: 20,
							backgroundColor:
								colorScheme === "dark"
									? "rgba(255,255,255,0.05)"
									: "rgba(0,0,0,0.03)",
							borderRadius: BORDER_RADIUS,
							borderWidth: 1,
							borderColor:
								colorScheme === "dark"
									? "rgba(255,255,255,0.1)"
									: "rgba(0,0,0,0.08)",
							borderStyle: "dashed",
							gap: 14,
						}}
					>
						<FolderPlus size={22} color={theme.textMuted} strokeWidth={2} />
						<Text
							style={{
								flex: 1,
								fontSize: 17,
								fontWeight: "400",
								color: theme.textMuted,
							}}
						>
							Create new folder
						</Text>
					</TouchableOpacity>
				</ScrollView>
			</SheetContent>
		</Sheet>
	);
}
