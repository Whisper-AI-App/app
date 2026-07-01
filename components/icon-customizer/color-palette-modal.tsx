import { useCallback, useEffect, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import { BORDER_RADIUS, FONT_SIZE } from "@/theme/globals";

const SQUARE_SIZE = 260;
const HUE_HEIGHT = 28;

// --- color math helpers (HSV <-> hex, no extra deps) ---

function hsvToHex(h: number, s: number, v: number): string {
	const c = v * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = v - c;
	let [r, g, b] = [0, 0, 0];
	if (h < 60) [r, g, b] = [c, x, 0];
	else if (h < 120) [r, g, b] = [x, c, 0];
	else if (h < 180) [r, g, b] = [0, c, x];
	else if (h < 240) [r, g, b] = [0, x, c];
	else if (h < 300) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];
	const toHex = (n: number) =>
		Math.round((n + m) * 255)
			.toString(16)
			.padStart(2, "0");
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string): [number, number, number] {
	let clean = hex.replace("#", "");
	if (clean.length === 3) {
		clean = clean.split("").map((c) => c + c).join("");
	}
	const r = Number.parseInt(clean.substring(0, 2), 16) / 255;
	const g = Number.parseInt(clean.substring(2, 4), 16) / 255;
	const b = Number.parseInt(clean.substring(4, 6), 16) / 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;

	let h = 0;
	if (delta !== 0) {
		if (max === r) {
			h = ((g - b) / delta) % 6;
		} else if (max === g) {
			h = (b - r) / delta + 2;
		} else {
			h = (r - g) / delta + 4;
		}
		h = Math.round(h * 60);
		if (h < 0) h += 360;
	}

	const s = max === 0 ? 0 : delta / max;
	const v = max;

	return [h, s, v];
}

interface ColorPaletteModalProps {
	visible: boolean;
	initialColor: string;
	onClose: () => void;
	onConfirm: (color: string) => void;
}

export function ColorPaletteModal({
	visible,
	initialColor,
	onClose,
	onConfirm,
}: ColorPaletteModalProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const hue = useSharedValue(0);
	const sat = useSharedValue(1);
	const val = useSharedValue(1);
	const [previewColor, setPreviewColor] = useState(initialColor);
	const [hueForGradient, setHueForGradient] = useState(0);

	useEffect(() => {
		if (visible) {
			const [h, s, v] = hexToHsv(initialColor);
			hue.value = h;
			sat.value = s;
			val.value = v;
			setHueForGradient(h);
			setPreviewColor(initialColor);
		}
	}, [visible, initialColor]);

	const updatePreview = useCallback((h: number, s: number, v: number) => {
		setPreviewColor(hsvToHex(h, s, v));
	}, []);

	const squareGesture = Gesture.Pan()
		.onChange((e) => {
			const x = Math.min(Math.max(e.x, 0), SQUARE_SIZE);
			const y = Math.min(Math.max(e.y, 0), SQUARE_SIZE);
			sat.value = x / SQUARE_SIZE;
			val.value = 1 - y / SQUARE_SIZE;
			updatePreview(hue.value, sat.value, val.value);
		})
		.onStart((e) => {
			const x = Math.min(Math.max(e.x, 0), SQUARE_SIZE);
			const y = Math.min(Math.max(e.y, 0), SQUARE_SIZE);
			sat.value = x / SQUARE_SIZE;
			val.value = 1 - y / SQUARE_SIZE;
			updatePreview(hue.value, sat.value, val.value);
		});

	const hueGesture = Gesture.Pan()
		.onChange((e) => {
			const x = Math.min(Math.max(e.x, 0), SQUARE_SIZE);
			hue.value = (x / SQUARE_SIZE) * 360;
			setHueForGradient(hue.value);
			updatePreview(hue.value, sat.value, val.value);
		})
		.onStart((e) => {
			const x = Math.min(Math.max(e.x, 0), SQUARE_SIZE);
			hue.value = (x / SQUARE_SIZE) * 360;
			setHueForGradient(hue.value);
			updatePreview(hue.value, sat.value, val.value);
		});

	const cursorStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateX: sat.value * SQUARE_SIZE - 10 },
			{ translateY: (1 - val.value) * SQUARE_SIZE - 10 },
		],
	}));

	const hueCursorStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: (hue.value / 360) * SQUARE_SIZE - 6 }],
	}));

	return (
		<Modal visible={visible} transparent animationType="slide">
			<View style={styles.backdrop}>
				<View style={[styles.sheet, { backgroundColor: theme.background }]}>
					<Text style={styles.title}>Choose a color</Text>

					{/* Saturation / Value square, tinted by the current hue */}
					<GestureDetector gesture={squareGesture}>
						<View style={styles.squareWrapper}>
							<Svg width={SQUARE_SIZE} height={SQUARE_SIZE}>
								<Defs>
									<LinearGradient id="sat" x1="0%" y1="0%" x2="100%" y2="0%">
										<Stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
										<Stop
											offset="100%"
											stopColor={hsvToHex(hueForGradient, 1, 1)}
											stopOpacity={1}
										/>
									</LinearGradient>
									<LinearGradient id="val" x1="0%" y1="0%" x2="0%" y2="100%">
										<Stop offset="0%" stopColor="#000000" stopOpacity={0} />
										<Stop offset="100%" stopColor="#000000" stopOpacity={1} />
									</LinearGradient>
								</Defs>
								<Rect
									width={SQUARE_SIZE}
									height={SQUARE_SIZE}
									fill="url(#sat)"
								/>
								<Rect
									width={SQUARE_SIZE}
									height={SQUARE_SIZE}
									fill="url(#val)"
								/>
							</Svg>
							<Animated.View style={[styles.cursor, cursorStyle]} />
						</View>
					</GestureDetector>

					{/* Hue strip */}
					<GestureDetector gesture={hueGesture}>
						<View style={styles.hueWrapper}>
							<Svg width={SQUARE_SIZE} height={HUE_HEIGHT}>
								<Defs>
									<LinearGradient id="hue" x1="0%" y1="0%" x2="100%" y2="0%">
										<Stop offset="0%" stopColor="#ff0000" />
										<Stop offset="16.66%" stopColor="#ffff00" />
										<Stop offset="33.33%" stopColor="#00ff00" />
										<Stop offset="50%" stopColor="#00ffff" />
										<Stop offset="66.66%" stopColor="#0000ff" />
										<Stop offset="83.33%" stopColor="#ff00ff" />
										<Stop offset="100%" stopColor="#ff0000" />
									</LinearGradient>
								</Defs>
								<Rect
									width={SQUARE_SIZE}
									height={HUE_HEIGHT}
									rx={HUE_HEIGHT / 2}
									fill="url(#hue)"
								/>
							</Svg>
							<Animated.View style={[styles.hueCursor, hueCursorStyle]} />
						</View>
					</GestureDetector>

					<View style={styles.previewRow}>
						<View
							style={[styles.previewSwatch, { backgroundColor: previewColor }]}
						/>
						<Text style={styles.previewLabel}>{previewColor}</Text>
					</View>

					<View style={styles.actions}>
						<Button variant="ghost" onPress={onClose}>
							Cancel
						</Button>
						<Button onPress={() => onConfirm(previewColor)}>
							Use this color
						</Button>
					</View>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.4)",
		justifyContent: "flex-end",
	},
	sheet: {
		padding: 24,
		borderTopLeftRadius: BORDER_RADIUS,
		borderTopRightRadius: BORDER_RADIUS,
		alignItems: "center",
	},
	title: {
		fontSize: FONT_SIZE,
		fontWeight: "600",
		marginBottom: 16,
	},
	squareWrapper: {
		width: SQUARE_SIZE,
		height: SQUARE_SIZE,
		borderRadius: 12,
		overflow: "hidden",
	},
	cursor: {
		position: "absolute",
		width: 20,
		height: 20,
		borderRadius: 10,
		borderWidth: 2,
		borderColor: "#ffffff",
	},
	hueWrapper: {
		width: SQUARE_SIZE,
		height: HUE_HEIGHT,
		marginTop: 16,
	},
	hueCursor: {
		position: "absolute",
		top: 2,
		width: HUE_HEIGHT - 4,
		height: HUE_HEIGHT - 4,
		borderRadius: (HUE_HEIGHT - 4) / 2,
		borderWidth: 2,
		borderColor: "#ffffff",
	},
	previewRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginTop: 20,
		alignSelf: "flex-start",
	},
	previewSwatch: {
		width: 32,
		height: 32,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "rgba(125,125,125,0.3)",
	},
	previewLabel: {
		fontSize: 15,
		fontWeight: "500",
	},
	actions: {
		flexDirection: "row",
		justifyContent: "flex-end",
		gap: 12,
		marginTop: 24,
		width: "100%",
	},
});