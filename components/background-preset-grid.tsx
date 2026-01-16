import { useColorScheme } from "@/hooks/useColorScheme";
import {
	BACKGROUND_PRESETS,
	type BackgroundPreset,
} from "@/src/data/background-presets";
import { Colors } from "@/theme/colors";
import { BORDER_RADIUS } from "@/theme/globals";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity, View } from "react-native";

interface BackgroundPresetGridProps {
	selectedPresetId: string | undefined;
	onSelectPreset: (preset: BackgroundPreset) => void;
}

/**
 * A grid component for displaying and selecting background presets
 */
export function BackgroundPresetGrid({
	selectedPresetId,
	onSelectPreset,
}: BackgroundPresetGridProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	return (
		<View style={styles.grid}>
			{BACKGROUND_PRESETS.map((preset) => {
				const isSelected = selectedPresetId === preset.id;

				return (
					<TouchableOpacity
						key={preset.id}
						style={[
							styles.presetItem,
							{ backgroundColor: theme.card },
							isSelected && { borderColor: theme.blue, borderWidth: 3 },
						]}
						onPress={() => onSelectPreset(preset)}
						activeOpacity={0.7}
					>
						{preset.id === "none" ? (
							<View
								style={[
									styles.nonePreset,
									{ backgroundColor: theme.background },
								]}
							>
								<Ionicons
									name="close-circle-outline"
									size={32}
									color={theme.textMuted}
								/>
							</View>
						) : (
							<Image
								source={preset.image}
								style={styles.presetImage}
								contentFit="cover"
							/>
						)}
						{isSelected && (
							<View style={[styles.checkmark, { backgroundColor: theme.blue }]}>
								<Ionicons name="checkmark" size={16} color="#FFFFFF" />
							</View>
						)}
						{/* <Text
              style={[
                styles.presetName,
                { color: isSelected ? theme.blue : theme.text },
              ]}
            >
              {preset.name}
            </Text> */}
					</TouchableOpacity>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
		paddingHorizontal: 16,
	},
	presetItem: {
		width: "30%",
		aspectRatio: 0.75,
		borderRadius: BORDER_RADIUS / 2,
		overflow: "hidden",
		alignItems: "center",
	},
	presetImage: {
		width: "100%",
		flex: 1,
	},
	nonePreset: {
		width: "100%",
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	presetName: {
		fontSize: 12,
		fontWeight: "500",
		paddingVertical: 8,
		textAlign: "center",
	},
	checkmark: {
		position: "absolute",
		top: 8,
		right: 8,
		width: 24,
		height: 24,
		borderRadius: 12,
		justifyContent: "center",
		alignItems: "center",
	},
});
