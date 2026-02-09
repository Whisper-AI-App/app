import type { ImageSource } from "expo-image";

export const APP_ICON_PRESETS = [
	{
		id: "Default",
		name: "Default",
		image: require("../../assets/images/icon.png"),
	},
	{
		id: "BlackAndWhite",
		name: "Black & White",
		image: require("../../assets/images/icon-variants/generated/black-and-white-preview.png"),
	},
	{
		id: "DarkBlueAndPurple",
		name: "Blue & Purple",
		image: require("../../assets/images/icon-variants/generated/dark-blue-and-purple-preview.png"),
	},
	{
		id: "DarkBlue",
		name: "Dark Blue",
		image: require("../../assets/images/icon-variants/generated/dark-blue-preview.png"),
	},
	{
		id: "Green",
		name: "Green",
		image: require("../../assets/images/icon-variants/generated/green-preview.png"),
	},
	{
		id: "LightBlueAndPink",
		name: "Blue & Pink",
		image: require("../../assets/images/icon-variants/generated/light-blue-and-pink-preview.png"),
	},
	{
		id: "OrangeAndPink",
		name: "Orange & Pink",
		image: require("../../assets/images/icon-variants/generated/orange-and-pink-preview.png"),
	},
] as const;

export type AppIconVariant = (typeof APP_ICON_PRESETS)[number]["id"];

export interface AppIconPreset {
	id: AppIconVariant;
	name: string;
	image: ImageSource;
}

export function getAppIconPresetById(
	id: AppIconVariant,
): AppIconPreset | undefined {
	return APP_ICON_PRESETS.find((preset) => preset.id === id);
}
