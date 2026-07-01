import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Text } from "@/components/ui/text";

interface ColorSwatchRowProps {
	label: string;
	presets: { id: string; color: string }[];
	selectedColor: string;
	isCustom: boolean;
	onSelectPreset: (color: string) => void;
	onOpenPalette: () => void;
}

const SWATCH_SIZE = 48;

export function ColorSwatchRow({
	label,
	presets,
	selectedColor,
	isCustom,
	onSelectPreset,
	onOpenPalette,
}: ColorSwatchRowProps) {
	return (
		<View style={styles.section}>
			<Text style={styles.label}>{label}</Text>
			<View style={styles.row}>
				{presets.map((preset) => {
					const selected = !isCustom && selectedColor === preset.color;
					return (
						<Pressable
							key={preset.id}
							onPress={() => onSelectPreset(preset.color)}
							style={[
								styles.swatch,
								{ backgroundColor: preset.color },
								selected && styles.swatchSelected,
							]}
						/>
					);
				})}

				{/* Gradient tile: opens the full color palette */}
				<Pressable
					onPress={onOpenPalette}
					style={[styles.swatch, isCustom && styles.swatchSelected]}
				>
					<Svg width={SWATCH_SIZE} height={SWATCH_SIZE}>
						<Defs>
							<LinearGradient
								id={`rainbow-${label}`}
								x1="0%"
								y1="0%"
								x2="100%"
								y2="100%"
							>
								<Stop offset="0%" stopColor="#ff5f6d" />
								<Stop offset="25%" stopColor="#ffc371" />
								<Stop offset="50%" stopColor="#47cf73" />
								<Stop offset="75%" stopColor="#3aa0ff" />
								<Stop offset="100%" stopColor="#a855f7" />
							</LinearGradient>
						</Defs>
						<Rect
							width={SWATCH_SIZE}
							height={SWATCH_SIZE}
							rx={SWATCH_SIZE / 4}
							fill={`url(#rainbow-${label})`}
						/>
					</Svg>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	section: {
		marginBottom: 20,
	},
	label: {
		fontSize: 13,
		fontWeight: "600",
		opacity: 0.7,
		marginBottom: 10,
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	swatch: {
		width: SWATCH_SIZE,
		height: SWATCH_SIZE,
		borderRadius: SWATCH_SIZE / 4,
		overflow: "hidden",
		borderWidth: 1,
		borderColor: "rgba(125,125,125,0.2)",
	},
	swatchSelected: {
		borderWidth: 3,
		borderColor: "#3aa0ff",
	},
});