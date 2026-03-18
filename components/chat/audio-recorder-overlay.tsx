import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import { ArrowUp, Trash2 } from "lucide-react-native";
import { type FC, useEffect, useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "../ui/text";
import { View } from "../ui/view";

interface AudioRecorderOverlayProps {
	isRecording: boolean;
	durationMs: number;
	onSend: () => void;
	onCancel: () => void;
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function WaveformDots() {
	const animations = useRef(
		Array.from({ length: 5 }, () => new Animated.Value(0.3)),
	).current;

	useEffect(() => {
		const pulses = animations.map((anim) =>
			Animated.loop(
				Animated.sequence([
					Animated.timing(anim, {
						toValue: 1,
						duration: 400,
						useNativeDriver: true,
					}),
					Animated.timing(anim, {
						toValue: 0.3,
						duration: 400,
						useNativeDriver: true,
					}),
				]),
			),
		);
		Animated.stagger(120, pulses).start();
		return () => {
			pulses.forEach((p) => {
				p.stop();
			});
		};
	}, [animations]);

	return (
		<View style={styles.waveform}>
			{animations.map((anim, i) => (
				<Animated.View key={i} style={[styles.waveDot, { opacity: anim }]} />
			))}
		</View>
	);
}

function RecordingPulse() {
	const scale = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		const pulse = Animated.loop(
			Animated.sequence([
				Animated.timing(scale, {
					toValue: 1.4,
					duration: 600,
					useNativeDriver: true,
				}),
				Animated.timing(scale, {
					toValue: 1,
					duration: 600,
					useNativeDriver: true,
				}),
			]),
		);
		pulse.start();
		return () => pulse.stop();
	}, [scale]);

	return (
		<Animated.View style={[styles.pulseOuter, { transform: [{ scale }] }]}>
			<View style={styles.pulseInner} />
		</Animated.View>
	);
}

export const AudioRecorderOverlay: FC<AudioRecorderOverlayProps> = ({
	isRecording,
	durationMs,
	onSend,
	onCancel,
}) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	if (!isRecording) return null;

	return (
		<View
			style={[
				styles.container,
				{ backgroundColor: `${theme.card}F0`, marginTop: 16 },
			]}
		>
			{/* Row 1: timer + waveform */}
			<View style={styles.topRow}>
				<Text style={[styles.timer, { color: theme.text }]}>
					{formatDuration(durationMs)}
				</Text>
				<WaveformDots />
			</View>

			{/* Row 2: cancel + pulse + send */}
			<View style={styles.bottomRow}>
				<TouchableOpacity
					onPress={onCancel}
					style={[
						styles.cancelButton,
						{ backgroundColor: `${theme.destructive}20` },
					]}
					hitSlop={8}
				>
					<Trash2 size={18} color={theme.destructive} strokeWidth={2} />
				</TouchableOpacity>

				<RecordingPulse />

				<TouchableOpacity
					onPress={onSend}
					style={[styles.sendButton, { backgroundColor: theme.green }]}
					hitSlop={8}
				>
					<ArrowUp size={18} color="#FFFFFF" strokeWidth={2.5} />
				</TouchableOpacity>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		borderRadius: 24,
		marginHorizontal: 8,
		marginBottom: 8,
		paddingHorizontal: 16,
		paddingVertical: 12,
		gap: 12,
	},
	topRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	timer: {
		fontSize: 16,
		fontWeight: "600",
		fontVariant: ["tabular-nums"],
	},
	waveform: {
		flexDirection: "row",
		alignItems: "center",
		gap: 5,
		flex: 1,
		justifyContent: "flex-end",
	},
	waveDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: "#FF3B30",
	},
	bottomRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	cancelButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		justifyContent: "center",
		alignItems: "center",
	},
	pulseOuter: {
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: "rgba(255, 59, 48, 0.2)",
		justifyContent: "center",
		alignItems: "center",
	},
	pulseInner: {
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: "#FF3B30",
	},
	sendButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		justifyContent: "center",
		alignItems: "center",
	},
});
