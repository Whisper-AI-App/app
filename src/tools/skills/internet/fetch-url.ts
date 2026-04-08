import type { ToolDefinition, ToolResult } from "../../types";

const FETCH_TIMEOUT_MS = 15000;
const DEFAULT_MAX_CHARS = 4000;

// Block private/local IPs
const PRIVATE_IP_PATTERNS = [
	/^localhost/i,
	/^127\./,
	/^10\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^192\.168\./,
	/^0\./,
	/^\[::1\]/,
	/^\[fc/i,
	/^\[fd/i,
];

function isPrivateUrl(urlStr: string): boolean {
	try {
		const parsed = new URL(urlStr);
		return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
	} catch {
		return true; // Invalid URL — treat as private
	}
}

/**
 * Convert HTML to readable plain text.
 * Lightweight implementation — strips tags, decodes entities,
 * extracts main content.
 */
function htmlToText(html: string): string {
	// Remove script, style, nav, header, footer tags and their content
	let text = html
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<nav[\s\S]*?<\/nav>/gi, "")
		.replace(/<header[\s\S]*?<\/header>/gi, "")
		.replace(/<footer[\s\S]*?<\/footer>/gi, "")
		.replace(/<!--[\s\S]*?-->/g, "");

	// Convert common block elements to newlines
	text = text
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<\/div>/gi, "\n")
		.replace(/<\/h[1-6]>/gi, "\n\n")
		.replace(/<\/li>/gi, "\n")
		.replace(/<li[^>]*>/gi, "- ");

	// Strip remaining tags
	text = text.replace(/<[^>]*>/g, "");

	// Decode HTML entities
	text = text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

	// Normalize whitespace
	text = text
		.replace(/[ \t]+/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	return text;
}

export const fetchUrlTool: ToolDefinition = {
	name: "fetch_url",
	description: "Fetch a webpage and return its text content.",
	parameters: [
		{
			name: "url",
			type: "string",
			description: "URL to fetch",
			required: true,
		},
	],
	readOnly: true,

	async execute(args): Promise<ToolResult> {
		const url = String(args.url);

		if (isPrivateUrl(url)) {
			return {
				toolCallId: "",
				content: "Cannot fetch private/local URLs.",
				isError: true,
			};
		}

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

			const response = await fetch(url, {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
					Accept: "text/html,application/xhtml+xml,text/plain",
					"Accept-Language": "en-US,en;q=0.9",
				},
				signal: controller.signal,
			});

			clearTimeout(timeout);

			if (!response.ok) {
				return {
					toolCallId: "",
					content: `Failed to fetch: HTTP ${response.status}`,
					isError: true,
				};
			}

			const contentType = response.headers.get("content-type") || "";
			const rawContent = await response.text();

			let text: string;
			if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
				text = htmlToText(rawContent);
			} else {
				text = rawContent;
			}

			// Truncate if necessary
			const maxChars = DEFAULT_MAX_CHARS;
			if (text.length > maxChars) {
				text = `${text.slice(0, maxChars)}\n\n[Content truncated — ${text.length - maxChars} characters omitted]`;
			}

			if (!text.trim()) {
				return {
					toolCallId: "",
					content: "The page returned no readable text content.",
					isError: false,
				};
			}

			return {
				toolCallId: "",
				content: text,
				isError: false,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown error";
			if (message.includes("abort")) {
				return {
					toolCallId: "",
					content: "Fetch timed out. The device may be offline.",
					isError: true,
				};
			}
			return {
				toolCallId: "",
				content: `Fetch error: ${message}`,
				isError: true,
			};
		}
	},

	validate(args) {
		const url = String(args.url);
		if (!url.startsWith("http://") && !url.startsWith("https://")) {
			return "Only http/https URLs allowed";
		}
		return null;
	},
};
