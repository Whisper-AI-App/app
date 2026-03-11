import { useColorScheme } from "@/hooks/useColorScheme";
import type { PendingAttachment } from "@/src/ai-providers/types";
import { Colors } from "@/theme/colors";
import { Image } from "expo-image";
import { Cloud, FileText, X } from "lucide-react-native";
import React from "react";
import {
	ScrollView,
	StyleSheet,
	TouchableOpacity,
} from "react-native";
import { Text } from "../ui/text";
import { View } from "../ui/view";

function formatFileSize(bytes: number): string {
	if (!bytes) return "";
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

interface AttachmentPreviewProps {
	attachments: PendingAttachment[];
	onRemove: (id: string) => void;
	/** Show cloud badge indicating data will leave device */
	isCloudProvider?: boolean;
}

const THUMBNAIL_SIZE = 72;

export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
	attachments,
	onRemove,
	isCloudProvider,
}) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	if (attachments.length === 0) return null;

	return (
		<ScrollView
			horizontal
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.container}
		>
			{attachments.map((att) => (
				<View key={att.id} style={styles.item}>
					{att.type === "image" ? (
						<Image
							source={{ uri: att.uri }}
							style={[
								styles.thumbnail,
								{ backgroundColor: theme.card },
							]}
							contentFit="cover"
						/>
					) : (
						<View
							style={[
								styles.thumbnail,
								styles.fileThumbnail,
								{ backgroundColor: theme.card },
							]}
						>
							<FileText size={24} color={theme.textMuted} strokeWidth={1.5} />
							<Text
								style={[styles.fileName, { color: theme.textMuted }]}
								numberOfLines={1}
							>
								{att.fileName}
							</Text>
							{att.fileSize > 0 && (
								<Text style={[styles.fileSize, { color: theme.textMuted }]}>
									{formatFileSize(att.fileSize)}
								</Text>
							)}
						</View>
					)}

					{isCloudProvider && (
						<View style={[styles.cloudBadge, { backgroundColor: `${theme.card}E0` }]}>
							<Cloud size={10} color={theme.textMuted} strokeWidth={2} />
						</View>
					)}

					<TouchableOpacity
						onPress={() => onRemove(att.id)}
						style={[
							styles.removeButton,
							{ backgroundColor: theme.text },
						]}
						hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
					>
						<X size={12} color={theme.background} strokeWidth={3} />
					</TouchableOpacity>
				</View>
			))}
		</ScrollView>
	);
};

const styles = StyleSheet.create({
	container: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		gap: 8,
	},
	item: {
		position: "relative",
	},
	thumbnail: {
		width: THUMBNAIL_SIZE,
		height: THUMBNAIL_SIZE,
		borderRadius: 12,
	},
	fileThumbnail: {
		justifyContent: "center",
		alignItems: "center",
		paddingHorizontal: 4,
		gap: 4,
	},
	fileName: {
		fontSize: 9,
		textAlign: "center",
	},
	fileSize: {
		fontSize: 8,
		textAlign: "center",
		opacity: 0.7,
	},
	cloudBadge: {
		position: "absolute",
		bottom: -2,
		left: -2,
		width: 18,
		height: 18,
		borderRadius: 9,
		justifyContent: "center",
		alignItems: "center",
	},
	removeButton: {
		position: "absolute",
		top: -4,
		right: -4,
		width: 20,
		height: 20,
		borderRadius: 10,
		justifyContent: "center",
		alignItems: "center",
	},
});
