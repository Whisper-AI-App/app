import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import { Cloud, FileText, Pause, Play } from "lucide-react-native";
import type React from "react";
import { useCallback, useRef, } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "../ui/text";
import { View } from "../ui/view";

interface StoredAttachment {
	id: string;
	type: string;
	uri: string;
	mimeType: string;
	fileName: string;
	fileSize: number;
	width: number;
	height: number;
	duration: number;
	alt: string;
	thumbnailUri: string;
}

interface MessageAttachmentsProps {
	attachments: StoredAttachment[];
	onImagePress?: (uri: string) => void;
	/** Show cloud badge indicating data was sent via cloud provider */
	isCloudMessage?: boolean;
}

function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.round(seconds % 60);
	if (mins > 0) return `${mins}:${secs.toString().padStart(2, "0")}`;
	return `0:${secs.toString().padStart(2, "0")}`;
}

/**
 * Audio player widget for a single audio attachment.
 */
const AudioPlayerWidget: React.FC<{
	attachment: StoredAttachment;
	theme: (typeof Colors)["light"];
}> = ({ attachment, theme }) => {
	const player = useAudioPlayer(attachment.uri);
	const status = useAudioPlayerStatus(player);
	const hasConfiguredAudio = useRef(false);

	const isPlaying = status.playing;
	const currentTime = status.currentTime ?? 0;
	const totalDuration = attachment.duration || (status.duration ?? 0);
	const progress = totalDuration > 0 ? currentTime / totalDuration : 0;
	const isAtEnd = totalDuration > 0 && currentTime >= totalDuration - 0.1;

	const handleTogglePlay = useCallback(async () => {
		if (isPlaying) {
			player.pause();
		} else {
			// Ensure audio session is configured for playback
			if (!hasConfiguredAudio.current) {
				await setAudioModeAsync({
					allowsRecording: false,
					playsInSilentMode: true,
				});
				hasConfiguredAudio.current = true;
			}
			// If playback finished, restart from the beginning
			if (isAtEnd) {
				await player.seekTo(0);
			}
			player.play();
		}
	}, [isPlaying, isAtEnd, player]);

	return (
		<TouchableOpacity
			onPress={handleTogglePlay}
			activeOpacity={0.7}
			style={[styles.audioCard, { backgroundColor: theme.card }]}
		>
			<View style={[styles.audioPlayButton, { backgroundColor: `${theme.primary}18` }]}>
				{isPlaying ? (
					<Pause size={14} color={theme.primary} fill={theme.primary} />
				) : (
					<Play size={14} color={theme.primary} fill={theme.primary} />
				)}
			</View>
			<View style={styles.audioInfo}>
				<View style={styles.audioProgressContainer}>
					<View
						style={[
							styles.audioProgressBar,
							{ backgroundColor: `${theme.textMuted}40` },
						]}
					>
						<View
							style={[
								styles.audioProgressFill,
								{
									backgroundColor: theme.primary,
									width: `${Math.min(progress * 100, 100)}%`,
								},
							]}
						/>
					</View>
				</View>
				<Text style={[styles.audioDuration, { color: theme.textMuted }]}>
					{isPlaying ? formatDuration(currentTime) : formatDuration(totalDuration)}
				</Text>
			</View>
		</TouchableOpacity>
	);
};

export const MessageAttachments: React.FC<MessageAttachmentsProps> = ({
	attachments,
	onImagePress,
	isCloudMessage,
}) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	if (attachments.length === 0) return null;

	return (
		<View style={styles.container}>
			{attachments.map((att) => {
				if (att.type === "image") {
					const imageUri = att.uri || att.thumbnailUri;
					return (
						<TouchableOpacity
							key={att.id}
							onPress={() => onImagePress?.(att.uri)}
							activeOpacity={0.8}
						>
							<Image
								source={{ uri: imageUri }}
								style={[
									styles.imageThumbnail,
									{ backgroundColor: theme.card },
								]}
								contentFit="cover"
							/>
							{isCloudMessage && (
								<View style={[styles.cloudBadge, { backgroundColor: `${theme.card}E0` }]}>
									<Cloud size={10} color={theme.textMuted} strokeWidth={2} />
								</View>
							)}
						</TouchableOpacity>
					);
				}

				if (att.type === "file") {
					return (
						<View
							key={att.id}
							style={[styles.fileCard, { backgroundColor: `${theme.card}80` }]}
						>
							<FileText size={18} color={theme.textMuted} strokeWidth={1.5} />
							<View style={styles.fileInfo}>
								<Text
									style={[styles.fileCardName, { color: theme.text }]}
									numberOfLines={1}
								>
									{att.fileName}
								</Text>
								<Text style={[styles.fileCardSize, { color: theme.textMuted }]}>
									{formatFileSize(att.fileSize)}
								</Text>
							</View>
							{isCloudMessage && (
								<Cloud size={12} color={theme.textMuted} strokeWidth={2} />
							)}
						</View>
					);
				}

				if (att.type === "audio") {
					return (
						<AudioPlayerWidget
							key={att.id}
							attachment={att}
							theme={theme}
						/>
					);
				}

				return null;
			})}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 6,
		paddingHorizontal: 8,
		paddingVertical: 4,
	},
	imageThumbnail: {
		width: 160,
		height: 120,
		borderRadius: 12,
	},
	cloudBadge: {
		position: "absolute",
		bottom: 4,
		left: 4,
		width: 18,
		height: 18,
		borderRadius: 9,
		justifyContent: "center",
		alignItems: "center",
	},
	fileCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 12,
		maxWidth: 200,
	},
	fileInfo: {
		flex: 1,
	},
	fileCardName: {
		fontSize: 13,
		fontWeight: "500",
	},
	fileCardSize: {
		fontSize: 11,
		marginTop: 1,
	},
	audioCard: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 12,
		minWidth: 180,
	},
	audioPlayButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		justifyContent: "center",
		alignItems: "center",
	},
	audioInfo: {
		flex: 1,
		gap: 4,
	},
	audioProgressContainer: {
		width: "100%",
	},
	audioProgressBar: {
		height: 3,
		borderRadius: 1.5,
		width: "100%",
		overflow: "hidden",
	},
	audioProgressFill: {
		height: "100%",
		borderRadius: 1.5,
	},
	audioDuration: {
		fontSize: 11,
	},
});
