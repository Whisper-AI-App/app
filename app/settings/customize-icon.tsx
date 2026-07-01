import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { Alert, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import {
	BirdIconPreview,
	type IconBackground,
} from "@/components/icon-customizer/bird-icon-preview";
import { ColorPaletteModal } from "@/components/icon-customizer/color-palette-modal";
import { ColorSwatchRow } from "@/components/icon-customizer/color-swatch-row";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColorScheme } from "@/hooks/useColorScheme";
import { setAppIconVariant } from "@/src/actions/app-icon";
import {
	BACKGROUND_PRESETS,
	BIRD_COLOR_PRESETS,
	findNearestIconVariant,
} from "@/src/data/icon-customizer-presets";
import { Colors } from "@/theme/colors";
import { CORNERS, HEIGHT } from "@/theme/globals";

type PaletteTarget = "bird" | "background" | null;

const DEFAULT_BIRD = BIRD_COLOR_PRESETS[0].color;
const DEFAULT_BACKGROUND = BACKGROUND_PRESETS[0].background;

export default function CustomizeIconScreen() {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const router = useRouter();

	const [birdColor, setBirdColor] = useState(DEFAULT_BIRD);
	const [background, setBackground] = useState<IconBackground>(DEFAULT_BACKGROUND);
	const [isBirdCustom, setIsBirdCustom] = useState(false);
	const [isBackgroundCustom, setIsBackgroundCustom] = useState(false);

	const [paletteTarget, setPaletteTarget] = useState<PaletteTarget>(null);
	const [isApplying, setIsApplying] = useState(false);

	const backgroundSolidColor =
		background.type === "solid" ? background.color : background.stops[0];

	const handleApply = async () => {
		Haptics.selectionAsync();
		setIsApplying(true);

		const nearest = findNearestIconVariant(birdColor, backgroundSolidColor);
		const result = await setAppIconVariant(nearest.id as never);

		setIsApplying(false);

		if (!result.success) {
			Alert.alert(
				"Unable to Apply Icon",
				result.error ?? "An unexpected error occurred",
			);
			return;
		}

		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		if (nearest.id !== "Custom" && (isBirdCustom || isBackgroundCustom)) {
			Alert.alert(
				"Closest Match Applied",
				`Your home screen icon can only use one of our pre-made variants, so we applied the closest match: ${nearest.id}. Your in-app preview keeps your exact colors.`,
			);
		}
	};

	const handleReset = () => {
		Haptics.selectionAsync();
		setBirdColor(DEFAULT_BIRD);
		setBackground(DEFAULT_BACKGROUND);
		setIsBirdCustom(false);
		setIsBackgroundCustom(false);
	};

	return (
		<SafeAreaView
			style={[styles.container, { backgroundColor: theme.background }]}
			edges={["top", "left", "right"]}
		>
			{/* Header */}
			<View
				style={[styles.header, { borderBottomColor: "rgba(125,125,125,0.15)" }]}
			>
				<Button onPress={() => router.back()} variant="ghost" size="icon">
					<ChevronLeft color={theme.textMuted} strokeWidth={2} size={24} />
				</Button>
				<Text style={styles.headerTitle} pointerEvents="none">
					Customize Icon
				</Text>
			</View>

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
			>
				{/* Preview Section */}
				<View style={styles.section}>
					<Text style={[styles.sectionLabel, { opacity: 0.7 }]}>
						PREVIEW
					</Text>
					<View style={styles.previewSection}>
						<BirdIconPreview
							birdColor={birdColor}
							background={background}
							size={120}
						/>
						<Text style={styles.previewHint}>Live preview</Text>
					</View>
				</View>

				<Separator style={styles.separator} />

				{/* Bird Color Section */}
				<View style={styles.section}>
					<View style={{ paddingHorizontal: 24 }}>
						<ColorSwatchRow
							label="BIRD COLOR"
							presets={BIRD_COLOR_PRESETS}
							selectedColor={birdColor}
							isCustom={isBirdCustom}
							onSelectPreset={(color) => {
								setBirdColor(color);
								setIsBirdCustom(false);
							}}
							onOpenPalette={() => setPaletteTarget("bird")}
						/>
					</View>
				</View>

				<Separator style={styles.separator} />

				{/* Background Section */}
				<View style={styles.section}>
					<View style={{ paddingHorizontal: 24 }}>
						<ColorSwatchRow
							label="BACKGROUND"
							presets={BACKGROUND_PRESETS.map((p) => ({
								id: p.id,
								color:
									p.background.type === "solid"
										? p.background.color
										: p.background.stops[0],
							}))}
							selectedColor={backgroundSolidColor}
							isCustom={isBackgroundCustom}
							onSelectPreset={(color) => {
								setBackground({ type: "solid", color });
								setIsBackgroundCustom(false);
							}}
							onOpenPalette={() => setPaletteTarget("background")}
						/>
					</View>
				</View>

				<Separator style={styles.separator} />

				{/* Action Buttons Section */}
				<View style={[styles.section, { paddingHorizontal: 24 }]}>
					<TouchableOpacity
						onPress={handleApply}
						disabled={isApplying}
						activeOpacity={0.8}
						style={styles.applyButtonWrapper}
					>
						<LinearGradient
							colors={["#ff9e37", "#ff5b91", "#69b7ff"]}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 0 }}
							style={styles.applyButtonGradient}
						>
							{isApplying ? (
								<ActivityIndicator color="#ffffff" />
							) : (
								<Text style={styles.applyButtonText}>Apply Changes</Text>
							)}
						</LinearGradient>
					</TouchableOpacity>

					<Button
						variant="secondary"
						size="default"
						onPress={handleReset}
						style={styles.resetButton}
					>
						Reset to Default
					</Button>

					<Text style={styles.sessionNote}>
						This customization lasts for this session only.
					</Text>
				</View>
			</ScrollView>

			<ColorPaletteModal
				visible={paletteTarget !== null}
				initialColor={
					paletteTarget === "bird" ? birdColor : backgroundSolidColor
				}
				onClose={() => setPaletteTarget(null)}
				onConfirm={(color) => {
					if (paletteTarget === "bird") {
						setBirdColor(color);
						setIsBirdCustom(true);
					} else if (paletteTarget === "background") {
						setBackground({ type: "solid", color });
						setIsBackgroundCustom(true);
					}
					setPaletteTarget(null);
				}}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
		borderBottomWidth: 1,
		position: "relative",
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "600",
		position: "absolute",
		left: 0,
		right: 0,
		textAlign: "center",
	},
	scrollView: {
		flex: 1,
	},
	scrollContent: {
		paddingBottom: 48,
	},
	section: {
		paddingTop: 24,
	},
	sectionLabel: {
		fontSize: 13,
		fontWeight: "600",
		marginBottom: 12,
		paddingHorizontal: 24,
	},
	separator: {
		marginTop: 24,
	},
	previewSection: {
		alignItems: "center",
		paddingHorizontal: 24,
	},
	previewHint: {
		marginTop: 12,
		fontSize: 13,
		opacity: 0.6,
	},
	applyButtonWrapper: {
		borderRadius: CORNERS,
		overflow: "hidden",
		width: "100%",
	},
	applyButtonGradient: {
		height: HEIGHT,
		alignItems: "center",
		justifyContent: "center",
	},
	applyButtonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "600",
		letterSpacing: 0.5,
	},
	resetButton: {
		marginTop: 16,
		width: "100%",
	},
	sessionNote: {
		marginTop: 16,
		fontSize: 12,
		opacity: 0.5,
		textAlign: "center",
	},
});