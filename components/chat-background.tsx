import { StyleSheet, View } from "react-native";
import { ImageBackground, Image } from "expo-image";
import { useValue } from "tinybase/ui-react";
import { useColorScheme } from "@/hooks/useColorScheme";
import type { BackgroundType } from "@/src/actions/chat-background";
import { getPresetById } from "@/src/data/background-presets";
import { Colors } from "@/theme/colors";

interface ChatBackgroundProps {
	children?: React.ReactNode;
	/** When true, positions as absolute background layer instead of flex container */
	asBackgroundLayer?: boolean;
}

// Default values for customization settings
const DEFAULT_BLUR = 0;
const DEFAULT_GRAIN = 0;
const DEFAULT_OPACITY = 70; // 70% opacity by default

/**
 * A component that renders a customizable background for the chat interface.
 * Supports blur, grain/noise, and opacity customization.
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
	const blur = (useValue("chat_background_blur") as number) ?? DEFAULT_BLUR;
	const grain = (useValue("chat_background_grain") as number) ?? DEFAULT_GRAIN;
	const opacity =
		(useValue("chat_background_opacity") as number) ?? DEFAULT_OPACITY;
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

		// Default: no background image (same as "none" preset)
		return null;
	};

	const source = getBackgroundSource();
	const hasBackgroundImage = source !== null;
	const imageOpacity = hasBackgroundImage ? opacity / 100 : 0.7;
	const shouldApplyBlur = hasBackgroundImage && blur > 0;
	const shouldApplyGrain = hasBackgroundImage && grain > 0;

	const containerStyle = asBackgroundLayer
		? [styles.backgroundLayer, { backgroundColor: theme.background }]
		: [styles.container, { backgroundColor: theme.background }];

	return (
		<View style={containerStyle}>
			{source && (
				<ImageBackground
					source={source}
					style={[StyleSheet.absoluteFillObject, { opacity: imageOpacity }]}
					contentFit="cover"
					blurRadius={shouldApplyBlur ? blur : 0}
				/>
			)}
			{/* Grain/noise overlay */}
			{shouldApplyGrain && (
				<Image
					source={
						colorScheme === "dark"
							? require("@/assets/images/grain-dark.png")
							: require("@/assets/images/grain.png")
					}
					style={[StyleSheet.absoluteFillObject, { opacity: grain / 100 }]}
					contentFit="cover"
				/>
			)}
			{/* Theme overlay for text readability */}
			<View
				style={[
					StyleSheet.absoluteFillObject,
					styles.overlay,
					{ backgroundColor: theme.background },
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
	overlay: {
		opacity: 0.3, // Light overlay for text readability
	},
});
