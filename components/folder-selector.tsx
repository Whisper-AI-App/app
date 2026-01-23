import * as Haptics from "expo-haptics";
import { Plus } from "lucide-react-native";
import { useRef, useState } from "react";
import { Platform, Pressable, ScrollView } from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { createFolder } from "@/src/actions/folder";
import { Colors } from "@/theme/colors";
import { PromptDialog } from "./ui/prompt-dialog";
import { Text } from "./ui/text";
import { View } from "./ui/view";

interface FolderSelectorProps {
	folders: Array<{ id: string; name: string; chatCount: number }>;
	totalChatCount: number;
	selectedFolderId: string | null;
	onSelectFolder: (folderId: string | null) => void;
	onLongPressFolder: (folderId: string) => void;
}

export function FolderSelector({
	folders,
	totalChatCount,
	selectedFolderId,
	onSelectFolder,
	onLongPressFolder,
}: FolderSelectorProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const scrollViewRef = useRef<ScrollView>(null);
	const [promptVisible, setPromptVisible] = useState(false);

	const handleCreateFolder = () => {
		if (Platform.OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		}
		setPromptVisible(true);
	};

	const handleConfirmCreate = (folderName: string) => {
		if (folderName.trim()) {
			const newFolderId = createFolder(folderName.trim());
			onSelectFolder(newFolderId);
			if (Platform.OS === "ios") {
				Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
			}
		}
		setPromptVisible(false);
	};

	const handleSelectFolder = (folderId: string | null) => {
		if (Platform.OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		}
		onSelectFolder(folderId);
	};

	const handleLongPressFolder = (folderId: string) => {
		if (Platform.OS === "ios") {
			Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
		}
		onLongPressFolder(folderId);
	};

	const renderPill = (
		key: string,
		label: string,
		count: number,
		isSelected: boolean,
		onPress: () => void,
		onLongPress?: () => void,
	) => (
		<Pressable
			key={key}
			onPress={onPress}
			onLongPress={onLongPress}
			style={{
				paddingHorizontal: 14,
				paddingVertical: 8,
				borderRadius: 20,
				backgroundColor: isSelected
					? theme.primary
					: colorScheme === "dark"
						? "rgba(255,255,255,0.1)"
						: "rgba(0,0,0,0.05)",
				borderWidth: 1,
				borderColor: isSelected
					? theme.primary
					: colorScheme === "dark"
						? "rgba(255,255,255,0.15)"
						: "rgba(0,0,0,0.08)",
			}}
		>
			<Text
				style={{
					fontSize: 13,
					fontWeight: "500",
					color: isSelected ? theme.primaryForeground : theme.text,
				}}
			>
				{label} ({count})
			</Text>
		</Pressable>
	);

	return (
		<>
			<View
				style={{
					paddingVertical: 12,
					borderBottomColor: "rgba(125,125,125,0.15)",
					borderBottomWidth: 1,
				}}
			>
				<ScrollView
				ref={scrollViewRef}
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={{
					paddingHorizontal: 16,
					gap: 8,
					flexDirection: "row",
					alignItems: "center",
				}}
			>
				{renderPill(
					"all-chats",
					"All Chats",
					totalChatCount,
					selectedFolderId === null,
					() => handleSelectFolder(null),
				)}

				{folders.map((folder) =>
					renderPill(
						folder.id,
						folder.name,
						folder.chatCount,
						selectedFolderId === folder.id,
						() => handleSelectFolder(folder.id),
						() => handleLongPressFolder(folder.id),
					),
				)}

				<Pressable
					onPress={handleCreateFolder}
					style={{
						paddingHorizontal: 12,
						paddingVertical: 8,
						borderRadius: 20,
						backgroundColor:
							colorScheme === "dark"
								? "rgba(255,255,255,0.1)"
								: "rgba(0,0,0,0.05)",
						borderWidth: 1,
						borderColor:
							colorScheme === "dark"
								? "rgba(255,255,255,0.15)"
								: "rgba(0,0,0,0.08)",
						borderStyle: "dashed",
						flexDirection: "row",
						alignItems: "center",
						gap: 4,
					}}
				>
					<Plus size={14} color={theme.textMuted} strokeWidth={2.5} />
					<Text
						style={{
							fontSize: 13,
							fontWeight: "500",
							color: theme.textMuted,
						}}
					>
						New
					</Text>
				</Pressable>
				</ScrollView>
			</View>

			<PromptDialog
				visible={promptVisible}
				title="New Folder"
				message="Enter a name for the folder"
				placeholder="Folder name"
				confirmText="Create"
				onConfirm={handleConfirmCreate}
				onCancel={() => setPromptVisible(false)}
			/>
		</>
	);
}
