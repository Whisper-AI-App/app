import { store } from "@/src/stores/store";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";

export type BackgroundType = "default" | "preset" | "custom";

/**
 * Request photo library permission and pick an image for the chat background
 * @returns true if image was successfully selected and saved, false otherwise
 */
export async function pickBackgroundFromLibrary(): Promise<{
	success: boolean;
	error?: string;
}> {
	try {
		// Check if ImagePicker is available (requires native build)
		if (!ImagePicker.launchImageLibraryAsync) {
			return {
				success: false,
				error: "Photo picker not available. Please rebuild the app.",
			};
		}

		const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

		if (!permission.granted) {
			return {
				success: false,
				error: "Permission to access photos was denied",
			};
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			quality: 0.8,
		});

		if (result.canceled) {
			return { success: false };
		}

		// Remove old custom background if exists
		await cleanupOldCustomBackground();

		// Copy image to app's document directory for persistence
		const asset = result.assets[0];
		const fileName = `chat-background-${Date.now()}.jpg`;
		const destinationUri = `${FileSystem.documentDirectory}${fileName}`;

		await FileSystem.copyAsync({
			from: asset.uri,
			to: destinationUri,
		});

		// Update store
		store.setValue("chat_background_type", "custom");
		store.setValue("chat_background_uri", destinationUri);
		store.setValue("chat_background_preset_id", "");

		return { success: true };
	} catch (error: unknown) {
		console.error("Failed to pick/save background image:", error);

		// Check for native module errors
		const errorMessage = error instanceof Error ? error.message : String(error);
		if (errorMessage.includes("native") || errorMessage.includes("undefined")) {
			return {
				success: false,
				error: "Photo picker requires a native rebuild. Run: npx expo run:ios",
			};
		}

		return {
			success: false,
			error: "Failed to select or save the image",
		};
	}
}

/**
 * Set a preset background
 */
export function setPresetBackground(presetId: string): void {
	// Clean up any existing custom background
	cleanupOldCustomBackground();

	store.setValue("chat_background_type", "preset");
	store.setValue("chat_background_uri", "");
	store.setValue("chat_background_preset_id", presetId);
}

/**
 * Reset to default background (none preset)
 */
export function resetToDefaultBackground(): void {
	cleanupOldCustomBackground();

	store.setValue("chat_background_type", "preset");
	store.setValue("chat_background_uri", "");
	store.setValue("chat_background_preset_id", "none");
}

/**
 * Remove old custom background file if it exists
 */
async function cleanupOldCustomBackground(): Promise<void> {
	const currentType = store.getValue("chat_background_type");
	const currentUri = store.getValue("chat_background_uri");

	if (currentType === "custom" && currentUri) {
		try {
			const fileInfo = await FileSystem.getInfoAsync(currentUri as string);
			if (fileInfo.exists) {
				await FileSystem.deleteAsync(currentUri as string, {
					idempotent: true,
				});
			}
		} catch (error) {
			console.warn("Failed to delete old background:", error);
		}
	}
}

/**
 * Check if the current custom background file still exists
 * Used to handle cases where the file was deleted externally
 */
export async function validateCustomBackground(): Promise<boolean> {
	const currentType = store.getValue("chat_background_type");
	const currentUri = store.getValue("chat_background_uri");

	if (currentType !== "custom" || !currentUri) {
		return true; // Not a custom background, so nothing to validate
	}

	try {
		const fileInfo = await FileSystem.getInfoAsync(currentUri as string);
		if (!fileInfo.exists) {
			// File is missing, reset to default
			resetToDefaultBackground();
			return false;
		}
		return true;
	} catch {
		resetToDefaultBackground();
		return false;
	}
}

/**
 * Set the background blur amount (0-20)
 */
export function setBackgroundBlur(blur: number): void {
	const clampedBlur = Math.max(0, Math.min(20, blur));
	store.setValue("chat_background_blur", clampedBlur);
}

/**
 * Set the background grain/noise amount (0-100)
 */
export function setBackgroundGrain(grain: number): void {
	const clampedGrain = Math.max(0, Math.min(100, grain));
	store.setValue("chat_background_grain", clampedGrain);
}

/**
 * Set the background opacity (0-100)
 */
export function setBackgroundOpacity(opacity: number): void {
	const clampedOpacity = Math.max(10, Math.min(100, opacity));
	store.setValue("chat_background_opacity", clampedOpacity);
}

/**
 * Reset adjustments to default values (blur: 0, grain: 0, opacity: 70)
 */
export function resetBackgroundAdjustments(): void {
	store.setValue("chat_background_blur", 0);
	store.setValue("chat_background_grain", 0);
	store.setValue("chat_background_opacity", 70);
}
