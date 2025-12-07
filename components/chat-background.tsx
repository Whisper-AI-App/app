import { useColorScheme } from "@/hooks/useColorScheme";
import type { BackgroundType } from "@/src/actions/chat-background";
import { getPresetById } from "@/src/data/background-presets";
import { Colors } from "@/theme/colors";
import { ImageBackground } from "expo-image";
import { StyleSheet, View } from "react-native";
import { useValue } from "tinybase/ui-react";

interface ChatBackgroundProps {
	children?: React.ReactNode;
	/** When true, positions as absolute background layer instead of flex container */
	asBackgroundLayer?: boolean;
}

/**
 * A component that renders a customizable background for the chat interface.
 * Uses a two-layer approach for readability:
 * 1. Background image at low opacity
 * 2. Theme background overlay at high opacity
 *
 * Can be used as a wrapper (default) or as an absolute positioned background layer.
 */
export function ChatBackground({
	children,
	asBackgroundLayer = false,
}: ChatBackgroundProps) {
	const backgroundType =
		(useValue("chat_background_type") as BackgroundType) ?? "default";
	const backgroundUri = useValue("chat_background_uri") as string | undefined;
	const presetId = useValue("chat_background_preset_id") as string | undefined;
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	// Determine the background image source
	const getBackgroundSource = () => {
		// Custom background from photo library
		if (backgroundType === "custom" && backgroundUri) {
			return { uri: backgroundUri };
		}

		// Preset background
		if (backgroundType === "preset" && presetId) {
			const preset = getPresetById(presetId);
			if (preset && preset.id !== "none") {
				return preset.image;
			}
			return null; // "none" preset means no background image
		}

		// Default: use the grain texture based on color scheme
		return colorScheme === "dark"
			? require("@/assets/images/grain-dark.png")
			: require("@/assets/images/grain.png");
	};

	const source = getBackgroundSource();

	const containerStyle = asBackgroundLayer
		? [styles.backgroundLayer, { backgroundColor: theme.background }]
		: [styles.container, { backgroundColor: theme.background }];

	return (
		<View style={containerStyle}>
			{source && (
				<ImageBackground
					source={source}
					style={[
						StyleSheet.absoluteFillObject,
						styles.backgroundImage,
						backgroundType === "default" ? { opacity: 0.65 } : {},
					]}
					contentFit="cover"
				/>
			)}
			{/* Overlay for readability - blends background with theme color */}
			<View
				style={[
					StyleSheet.absoluteFillObject,
					styles.overlay,
					{ backgroundColor: theme.background },
					backgroundType === "default" ? { opacity: 0.4 } : {},
				]}
			/>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	backgroundLayer: {
		position: "absolute",
		top: 0,
		left: 0,
		width: "100%",
		height: "100%",
	},
	backgroundImage: {
		opacity: 0.8, // Image opacity - prominently visible
	},
	overlay: {
		opacity: 0.3, // Light overlay for text readability
	},
});
