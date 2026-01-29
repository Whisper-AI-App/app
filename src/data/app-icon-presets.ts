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
		image: require("../../assets/images/icon-variants/black-and-white.png"),
	},
	{
		id: "DarkBlueAndPurple",
		name: "Blue & Purple",
		image: require("../../assets/images/icon-variants/dark-blue-and-purple.png"),
	},
	{
		id: "DarkBlue",
		name: "Dark Blue",
		image: require("../../assets/images/icon-variants/dark-blue.png"),
	},
	{
		id: "Green",
		name: "Green",
		image: require("../../assets/images/icon-variants/green.png"),
	},
	{
		id: "LightBlueAndPink",
		name: "Blue & Pink",
		image: require("../../assets/images/icon-variants/light-blue-and-pink.png"),
	},
	{
		id: "OrangeAndPink",
		name: "Orange & Pink",
		image: require("../../assets/images/icon-variants/orange-and-pink.png"),
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
