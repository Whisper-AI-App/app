#!/usr/bin/env node
/**
 * Generates complete credits data from node_modules at build time
 * This runs during postinstall to avoid runtime overhead
 */

const fs = require("node:fs");
const path = require("node:path");

const packageJsonPath = path.join(__dirname, "..", "package.json");
const outputPath = path.join(
	__dirname,
	"..",
	"src",
	"data",
	"generated-authors.json",
);

/**
 * Featured package overrides - static configuration
 */
const FEATURED_PACKAGE_OVERRIDES = {
	// Featured - The stars of the show
	"llama.rn": { author: "llama.RN", priority: 1, pinned: true },
	tinybase: { author: "Tinybase", priority: 2, pinned: true },

	// Core Platform - Group all Expo packages together
	expo: { author: "Expo", priority: 3 },
	"@expo/": { author: "Expo", priority: 3 }, // prefix

	// Core Framework - Group all Meta/React packages together
	react: { author: "Meta", priority: 4 },
	"react-native": { author: "Meta", priority: 4 },
	"react-dom": { author: "Meta", priority: 4 },
};

/**
 * Curated author information with descriptions and URLs
 */
const AUTHOR_INFO = {
	"llama.RN": {
		description:
			"On-device LLM inference engine enabling completely private AI conversations",
		url: "https://github.com/mybigday/llama.rn",
		section: "featured",
	},
	Tinybase: {
		description:
			"Reactive data store powering Whisper's state management and persistence",
		url: "https://tinybase.org",
		section: "featured",
	},
	Expo: {
		description:
			"Complete platform for building, deploying, and updating React Native apps",
		url: "https://expo.dev",
		section: "platform",
	},
	Meta: {
		description:
			"Creators of React and React Native, the foundation of modern mobile development",
		url: "https://reactnative.dev",
		section: "platform",
	},
};

/**
 * Parses author field from package.json
 */
function parseAuthorName(author) {
	if (!author) return null;

	if (typeof author === "string") {
		// Parse "Author Name <email@example.com>" format
		const match = author.match(/^([^<]+)/);
		return match ? match[1].trim() : author.trim();
	}

	if (typeof author === "object" && author.name) {
		return author.name.trim();
	}

	return null;
}

/**
 * Reads package.json from node_modules
 */
function readPackageJson(packageName) {
	try {
		const pkgPath = path.join(
			__dirname,
			"..",
			"node_modules",
			packageName,
			"package.json",
		);
		const content = fs.readFileSync(pkgPath, "utf8");
		return JSON.parse(content);
	} catch (_error) {
		return null;
	}
}

/**
 * Extracts author info for a package from node_modules
 */
function extractAuthorFromNodeModules(packageName) {
	const pkgJson = readPackageJson(packageName);
	if (!pkgJson) return null;

	const authorName = parseAuthorName(pkgJson.author);
	if (!authorName) return null;

	let url;
	if (pkgJson.homepage) {
		url = pkgJson.homepage;
	} else if (typeof pkgJson.repository === "object" && pkgJson.repository.url) {
		// Convert git URL to https
		url = pkgJson.repository.url
			.replace(/^git\+/, "")
			.replace(/\.git$/, "")
			.replace(/^git:/, "https:");
	} else if (typeof pkgJson.repository === "string") {
		url = pkgJson.repository;
	}

	return { author: authorName, url };
}

/**
 * Gets author and homepage URL for a package
 * Checks featured overrides first, then extracts from node_modules
 */
function getAuthorForPackage(packageName) {
	// Check featured overrides first (exact match)
	if (FEATURED_PACKAGE_OVERRIDES[packageName]) {
		return FEATURED_PACKAGE_OVERRIDES[packageName];
	}

	// Check prefix matches for featured overrides
	for (const [key, value] of Object.entries(FEATURED_PACKAGE_OVERRIDES)) {
		if (key.endsWith("/") || key.endsWith("-")) {
			if (packageName.startsWith(key)) {
				return value;
			}
		}
	}

	// Extract from node_modules
	const extracted = extractAuthorFromNodeModules(packageName);
	if (extracted) {
		return {
			author: extracted.author,
			priority: 50, // Default priority for dynamic packages
			url: extracted.url,
		};
	}

	// Fallback for packages without author info
	return {
		author: "Other Libraries",
		priority: 99,
	};
}

/**
 * Formats package list for display
 */
function formatPackageList(packages) {
	const sorted = [...packages].sort();

	if (sorted.length <= 3) {
		return sorted;
	}

	const displayed = sorted.slice(0, 3);
	const remaining = sorted.length - 3;
	return [...displayed, `+ ${remaining} more`];
}

/**
 * Generates a description for an author based on their packages
 */
function generateDescription(packages) {
	const count = packages.length;
	if (count === 1) {
		return `Creator of ${packages[0]}`;
	}
	return `Contributing ${count} open source ${count === 1 ? "library" : "libraries"}`;
}

/**
 * Main function - generates complete credits array
 */
function generateCredits() {
	console.log("Generating credits from dependencies...");

	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
	const dependencies = packageJson.dependencies || {};

	// Group packages by author, collecting URLs along the way
	const authorPackagesMap = new Map();

	for (const packageName of Object.keys(dependencies)) {
		const { author, priority, pinned, url } = getAuthorForPackage(packageName);

		if (!authorPackagesMap.has(author)) {
			authorPackagesMap.set(author, {
				packages: [],
				priority,
				pinned,
				urls: new Set(),
			});
		}

		const entry = authorPackagesMap.get(author);
		entry.packages.push(packageName);
		if (url) {
			entry.urls.add(url);
		}
	}

	// Convert to credits array
	const credits = [];

	for (const [
		author,
		{ packages, priority, pinned, urls },
	] of authorPackagesMap) {
		const info = AUTHOR_INFO[author];

		// For dynamic authors, use curated info if available, otherwise generate
		const description = info?.description || generateDescription(packages);
		const url =
			info?.url || (urls.size === 1 ? Array.from(urls)[0] : undefined);
		const section = info?.section || "libraries";

		credits.push({
			author,
			description,
			packages: formatPackageList(packages),
			url,
			priority,
			pinned,
			section,
		});
	}

	// Sort by priority (lower number = higher priority), then by name
	credits.sort((a, b) => {
		if (a.priority !== b.priority) {
			return a.priority - b.priority;
		}
		return a.author.localeCompare(b.author);
	});

	// Group by section
	const creditsBySection = {};
	for (const credit of credits) {
		if (!creditsBySection[credit.section]) {
			creditsBySection[credit.section] = [];
		}
		creditsBySection[credit.section].push(credit);
	}

	// Write to output file
	const output = {
		generatedAt: new Date().toISOString(),
		credits,
		creditsBySection,
	};

	fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), "utf8");

	console.log(
		`✓ Generated credits for ${Object.keys(authorPackagesMap).length} authors`,
	);
	console.log(`  Total packages: ${Object.keys(dependencies).length}`);
	console.log(`  Output: ${outputPath}`);
}

// Run it
generateCredits();
