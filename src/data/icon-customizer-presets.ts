import type { IconBackground } from "@/components/icon-customizer/bird-icon-preview";
import { ICON_VARIANTS, type IconVariant } from "@/scripts/icon-config";

export const BIRD_COLOR_PRESETS = [
	{ id: "white", color: "#ffffff" },
	{ id: "black", color: "#121212" },
	{ id: "blue", color: "#5a91de" },
	{ id: "green", color: "#47cf73" },
	{ id: "pink", color: "#ef85dd" },
];

export const BACKGROUND_PRESETS: { id: string; background: IconBackground }[] =
	ICON_VARIANTS.map((v) => ({
		id: v.id.toLowerCase(),
		background: {
			type: "solid",
			color:
				v.background.type === "solid"
					? v.background.color
					: v.background.stops[0].color,
		},
	}));

function hexToRgb(hex: string): [number, number, number] {
	const clean = hex.replace("#", "");
	const r = Number.parseInt(clean.substring(0, 2), 16);
	const g = Number.parseInt(clean.substring(2, 4), 16);
	const b = Number.parseInt(clean.substring(4, 6), 16);
	return [r, g, b];
}

function colorDistance(a: string, b: string): number {
	const [r1, g1, b1] = hexToRgb(a);
	const [r2, g2, b2] = hexToRgb(b);
	return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function variantBgColor(variant: IconVariant): string {
	return variant.background.type === "solid"
		? variant.background.color
		: variant.background.stops[0].color;
}

/**
 * The real home-screen icon can only ever be one of the build-time
 * pre-baked variants in ICON_VARIANTS (expo-alternate-app-icons requires
 * names declared in app.json). This finds the closest match to whatever
 * the user actually picked, so "Apply Changes" never errors out — it
 * just snaps to the nearest real icon for the launcher, while the
 * in-app live preview stays exact.
 */
export function findNearestIconVariant(
	birdColor: string,
	bgColor: string,
): IconVariant {
	let closest = ICON_VARIANTS[0];
	let closestDistance = Number.POSITIVE_INFINITY;

	for (const variant of ICON_VARIANTS) {
		const distance =
			colorDistance(variant.birdFill, birdColor) +
			colorDistance(variantBgColor(variant), bgColor);
		if (distance < closestDistance) {
			closestDistance = distance;
			closest = variant;
		}
	}

	return closest;
}