import { useColorScheme } from "@/hooks/useColorScheme";
import type { MultimodalCapabilities } from "@/src/ai-providers/types";
import { Colors } from "@/theme/colors";
import * as ImagePicker from "expo-image-picker";
import { Image } from "lucide-react-native";
import { type FC, useCallback } from "react";
import { Alert, Linking, StyleSheet, TouchableOpacity } from "react-native";

function showPermissionDeniedAlert(permissionName: string): void {
	Alert.alert(
		`${permissionName} Access Required`,
		`Please enable ${permissionName.toLowerCase()} access in your device settings to use this feature.`,
		[
			{ text: "Cancel", style: "cancel" },
			{ text: "Open Settings", onPress: () => Linking.openSettings() },
		],
	);
}

interface AttachmentButtonProps {
	capabilities: MultimodalCapabilities;
	canAddImage: boolean;
	disabled?: boolean;
	onImageSelected: (
		uri: string,
		mimeType: string,
		width?: number,
		height?: number,
		fileName?: string,
		fileSize?: number,
	) => void;
}

export const AttachmentButton: FC<AttachmentButtonProps> = ({
	capabilities,
	canAddImage,
	disabled,
	onImageSelected,
}) => {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const handlePress = useCallback(async () => {
		const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
		if (status !== "granted") {
			showPermissionDeniedAlert("Photo Library");
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			quality: 1,
			allowsMultipleSelection: false,
		});

		if (!result.canceled && result.assets[0]) {
			const asset = result.assets[0];
			onImageSelected(
				asset.uri,
				asset.mimeType ?? "image/jpeg",
				asset.width,
				asset.height,
				asset.fileName ?? undefined,
				asset.fileSize ?? undefined,
			);
		}
	}, [onImageSelected]);

	if (!capabilities.vision) return null;

	return (
		<TouchableOpacity
			onPress={handlePress}
			disabled={disabled || !canAddImage}
			activeOpacity={0.6}
			style={[styles.button, { opacity: disabled || !canAddImage ? 0.4 : 1 }]}
		>
			<Image size={22} color={theme.text} strokeWidth={2} />
		</TouchableOpacity>
	);
};

const styles = StyleSheet.create({
	button: {
		padding: 8,
		justifyContent: "center",
		alignItems: "center",
	},
});
