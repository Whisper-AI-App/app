/**
 * Credits data types and section configuration
 * Actual credits data is generated at build time in generated-authors.json
 */

export interface AuthorCredit {
	author: string;
	description: string;
	packages: string[];
	url?: string;
	priority: number;
	pinned?: boolean;
	section: string;
}

/**
 * Section display order and titles
 */
export const CREDIT_SECTIONS = [
	{ key: "featured", title: "FEATURED" },
	{ key: "platform", title: "PLATFORM & FRAMEWORK" },
	{ key: "libraries", title: "OPEN SOURCE LIBRARIES" },
] as const;
