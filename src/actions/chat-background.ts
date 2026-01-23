import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { mainStore } from "@/src/stores/main/main-store";

// Max dimensions for background images to prevent memory issues
const MAX_BACKGROUND_WIDTH = 1920;
const MAX_BACKGROUND_HEIGHT = 1920;
const TARGET_MAX_SIZE_BYTES = 1024 * 1024; // 1MB
const INITIAL_COMPRESSION_QUALITY = 0.8;
const MIN_COMPRESSION_QUALITY = 0.3;
const QUALITY_STEP = 0.1;

export type BackgroundType = "default" | "preset" | "custom";

/**
 * Compress and resize an image to reduce memory usage and improve loading performance.
 * Dynamically adjusts compression to ensure the output is under 1MB.
 * @param uri - The URI of the image to process
 * @returns The processed image result with a new URI
 */
async function compressAndResizeImage(
	uri: string,
): Promise<ImageManipulator.ImageResult> {
	const context = ImageManipulator.ImageManipulator.manipulate(uri);

	// Resize to fit within max dimensions while maintaining aspect ratio
	const resized = context.resize({
		width: MAX_BACKGROUND_WIDTH,
		height: MAX_BACKGROUND_HEIGHT,
	});

	const rendered = await resized.renderAsync();

	// Try progressively lower quality until we're under the target size
	let quality = INITIAL_COMPRESSION_QUALITY;
	let result = await rendered.saveAsync({
		format: ImageManipulator.SaveFormat.JPEG,
		compress: quality,
	});

	let fileInfo = await FileSystem.getInfoAsync(result.uri);
	let fileSize = fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0;

	while (fileSize > TARGET_MAX_SIZE_BYTES && quality > MIN_COMPRESSION_QUALITY) {
		quality -= QUALITY_STEP;
		console.log(
			`[Background] File size ${(fileSize / 1024).toFixed(0)} KB exceeds 1MB, retrying with quality ${quality.toFixed(1)}`,
		);

		result = await rendered.saveAsync({
			format: ImageManipulator.SaveFormat.JPEG,
			compress: quality,
		});

		fileInfo = await FileSystem.getInfoAsync(result.uri);
		fileSize = fileInfo.exists && "size" in fileInfo ? fileInfo.size : 0;
	}

	return result;
}

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

		// Compress and resize the image before saving
		const asset = result.assets[0];

		// Log original file size
		const originalInfo = await FileSystem.getInfoAsync(asset.uri);
		const originalSizeKB =
			originalInfo.exists && "size" in originalInfo
				? (originalInfo.size / 1024).toFixed(2)
				: "unknown";
		console.log(`[Background] Original image size: ${originalSizeKB} KB`);

		const processedImage = await compressAndResizeImage(asset.uri);

		// Log compressed file size
		const compressedInfo = await FileSystem.getInfoAsync(processedImage.uri);
		const compressedSizeKB =
			compressedInfo.exists && "size" in compressedInfo
				? (compressedInfo.size / 1024).toFixed(2)
				: "unknown";
		console.log(`[Background] Compressed image size: ${compressedSizeKB} KB`);
		console.log(
			`[Background] Size reduction: ${originalSizeKB !== "unknown" && compressedSizeKB !== "unknown" ? (((Number(originalSizeKB) - Number(compressedSizeKB)) / Number(originalSizeKB)) * 100).toFixed(1) : "N/A"}%`,
		);

		const fileName = `chat-background-${Date.now()}.jpg`;
		const destinationUri = `${FileSystem.documentDirectory}${fileName}`;

		await FileSystem.moveAsync({
			from: processedImage.uri,
			to: destinationUri,
		});

		// Update store
		mainStore.setValue("chat_background_type", "custom");
		mainStore.setValue("chat_background_uri", destinationUri);
		mainStore.setValue("chat_background_preset_id", "");

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

	mainStore.setValue("chat_background_type", "preset");
	mainStore.setValue("chat_background_uri", "");
	mainStore.setValue("chat_background_preset_id", presetId);
}

/**
 * Reset to default background (none preset)
 */
export function resetToDefaultBackground(): void {
	cleanupOldCustomBackground();

	mainStore.setValue("chat_background_type", "preset");
	mainStore.setValue("chat_background_uri", "");
	mainStore.setValue("chat_background_preset_id", "none");
}

/**
 * Remove old custom background file if it exists
 */
async function cleanupOldCustomBackground(): Promise<void> {
	const currentType = mainStore.getValue("chat_background_type");
	const currentUri = mainStore.getValue("chat_background_uri");

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
	const currentType = mainStore.getValue("chat_background_type");
	const currentUri = mainStore.getValue("chat_background_uri");

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
	mainStore.setValue("chat_background_blur", clampedBlur);
}

/**
 * Set the background grain/noise amount (0-100)
 */
export function setBackgroundGrain(grain: number): void {
	const clampedGrain = Math.max(0, Math.min(100, grain));
	mainStore.setValue("chat_background_grain", clampedGrain);
}

/**
 * Set the background opacity (0-100)
 */
export function setBackgroundOpacity(opacity: number): void {
	const clampedOpacity = Math.max(10, Math.min(100, opacity));
	mainStore.setValue("chat_background_opacity", clampedOpacity);
}

/**
 * Reset adjustments to default values (blur: 0, grain: 0, opacity: 70)
 */
export function resetBackgroundAdjustments(): void {
	mainStore.setValue("chat_background_blur", 0);
	mainStore.setValue("chat_background_grain", 0);
	mainStore.setValue("chat_background_opacity", 70);
}
