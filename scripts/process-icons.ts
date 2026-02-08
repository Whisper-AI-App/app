import { Resvg } from "@resvg/resvg-js";
import * as fs from "node:fs";
import * as path from "node:path";
import { ICON_VARIANTS, type IconVariant } from "./icon-config";

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const ASSETS_DIR = path.resolve(SCRIPT_DIR, "../assets/images/icon-variants");
const OUTPUT_DIR = path.join(ASSETS_DIR, "generated");
const BIRD_SVG_PATH = path.join(ASSETS_DIR, "bird.svg");

// Output configurations: size and bird scale
// Android adaptive icons have a safe zone (inner 66%), so we use a smaller bird scale
const OUTPUT_CONFIGS = {
	ios: { size: 1024, birdScale: 0.7 },
	adaptive: { size: 1024, birdScale: 0.5 }, // Smaller to fit Android safe zone
	preview: { size: 256, birdScale: 0.7 },
};

const BIRD_OPACITY = 0.85;

function readBirdSvg(): string {
	return fs.readFileSync(BIRD_SVG_PATH, "utf-8");
}

function extractBirdPaths(svgContent: string): string[] {
	const pathRegex = /<path[^>]*d="([^"]+)"[^>]*\/>/g;
	const matches = svgContent.matchAll(pathRegex);
	return Array.from(matches, (match) => match[1]);
}

function generateGradientDef(variant: IconVariant, gradientId: string): string {
	if (variant.background.type === "solid") {
		return "";
	}

	const { stops, direction } = variant.background;
	// SVG gradient coordinates: to-top means y1=100%, y2=0%
	const y1 = direction === "to-top" ? "100%" : "0%";
	const y2 = direction === "to-top" ? "0%" : "100%";

	const stopElements = stops
		.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}" />`)
		.join("\n      ");

	return `
    <linearGradient id="${gradientId}" x1="50%" y1="${y1}" x2="50%" y2="${y2}">
      ${stopElements}
    </linearGradient>`;
}

function generateComposedSvg(
	variant: IconVariant,
	birdPaths: string[],
	size: number,
	birdScale: number,
): string {
	const gradientId = `bg-gradient-${variant.id}`;
	const gradientDef = generateGradientDef(variant, gradientId);

	const bgFill =
		variant.background.type === "solid"
			? variant.background.color
			: `url(#${gradientId})`;

	// Calculate bird positioning
	const birdSize = size * birdScale;
	const offset = (size - birdSize) / 2;

	// The bird SVG has a 24x24 viewBox, scale it to birdSize
	const scale = birdSize / 24;

	// Generate bird path elements
	const birdPathElements = birdPaths
		.map((d) => `<path d="${d}" fill="${variant.birdFill}" />`)
		.join("\n        ");

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>${gradientDef}
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" fill="${bgFill}" />

  <!-- Bird (scaled, centered, with opacity) -->
  <g transform="translate(${offset}, ${offset}) scale(${scale})" opacity="${BIRD_OPACITY}">
    ${birdPathElements}
  </g>
</svg>`;
}

function renderSvgToPng(svgContent: string, width: number): Buffer {
	const resvg = new Resvg(svgContent, {
		fitTo: {
			mode: "width",
			value: width,
		},
	});
	const pngData = resvg.render();
	return pngData.asPng();
}

function toKebabCase(str: string): string {
	return str
		.replace(/([a-z])([A-Z])/g, "$1-$2")
		.replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
		.toLowerCase();
}

async function main() {
	console.log("Processing app icons...\n");

	// Ensure output directory exists
	if (!fs.existsSync(OUTPUT_DIR)) {
		fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	}

	// Read and parse bird SVG
	const birdSvgContent = readBirdSvg();
	const birdPaths = extractBirdPaths(birdSvgContent);
	console.log(`Found ${birdPaths.length} paths in bird.svg\n`);

	let totalFiles = 0;

	for (const variant of ICON_VARIANTS) {
		const kebabId = toKebabCase(variant.id);
		console.log(`Processing ${variant.id}...`);

		// Generate and save each output type
		for (const [suffix, config] of Object.entries(OUTPUT_CONFIGS)) {
			const svgContent = generateComposedSvg(
				variant,
				birdPaths,
				config.size,
				config.birdScale,
			);
			const pngBuffer = renderSvgToPng(svgContent, config.size);

			const filename = `${kebabId}-${suffix}.png`;
			const outputPath = path.join(OUTPUT_DIR, filename);

			fs.writeFileSync(outputPath, pngBuffer);
			console.log(
				`  - ${filename} (${config.size}x${config.size}, bird: ${Math.round(config.birdScale * 100)}%)`,
			);
			totalFiles++;
		}

		console.log("");
	}

	console.log(`Done! Generated ${totalFiles} PNG files in:`);
	console.log(`  ${OUTPUT_DIR}`);
}

main().catch(console.error);
