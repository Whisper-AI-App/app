import { parseDocument } from "htmlparser2";
import { findAll, getAttributeValue, getText } from "domutils";
import type { ToolDefinition, ToolResult } from "../../types";

const DDG_HTML_URL = "https://html.duckduckgo.com/html/";
const SEARCH_TIMEOUT_MS = 10000;
const DEFAULT_MAX_RESULTS = 5;

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

/**
 * Extract the real URL from DuckDuckGo's redirect link.
 * DDG wraps URLs like: //duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com&rut=...
 */
function extractRealUrl(ddgUrl: string): string {
	try {
		const fullUrl = ddgUrl.startsWith("//")
			? `https:${ddgUrl}`
			: ddgUrl;
		const parsed = new URL(fullUrl);
		const uddg = parsed.searchParams.get("uddg");
		return uddg || fullUrl;
	} catch {
		return ddgUrl;
	}
}

/**
 * Parse DuckDuckGo HTML search results using htmlparser2.
 * html.duckduckgo.com returns server-rendered HTML — no JS execution needed.
 */
function parseSearchResults(
	html: string,
	maxResults: number,
): SearchResult[] {
	const doc = parseDocument(html);
	const results: SearchResult[] = [];

	// Find result title links (class="result__a")
	const resultLinks = findAll(
		(el) =>
			el.name === "a" &&
			(getAttributeValue(el, "class") || "").includes("result__a"),
		doc.children,
	);

	// Find result snippets (class="result__snippet")
	const snippetElems = findAll(
		(el) =>
			(getAttributeValue(el, "class") || "").includes("result__snippet"),
		doc.children,
	);

	for (let i = 0; i < resultLinks.length && results.length < maxResults; i++) {
		const link = resultLinks[i];
		const rawUrl = getAttributeValue(link, "href") || "";
		const url = extractRealUrl(rawUrl);
		const title = getText(link).trim();

		// Match snippet by index
		const snippet = snippetElems[i]
			? getText(snippetElems[i]).trim()
			: "";

		if (url && title && url.startsWith("http")) {
			results.push({ title, url, snippet });
		}
	}

	return results;
}

export const webSearchTool: ToolDefinition = {
	name: "web_search",
	description: "Search the internet. Returns titles, URLs, and snippets.",
	parameters: [
		{
			name: "query",
			type: "string",
			description: "Search query",
			required: true,
		},
		{
			name: "max_results",
			type: "number",
			description: "Max results (default 5)",
			required: false,
		},
	],
	readOnly: true,

	async execute(args): Promise<ToolResult> {
		const query = String(args.query);
		const maxResults =
			typeof args.max_results === "number"
				? Math.min(Math.max(args.max_results, 1), 10)
				: DEFAULT_MAX_RESULTS;

		try {
			const url = `${DDG_HTML_URL}?q=${encodeURIComponent(query)}`;

			const controller = new AbortController();
			const timeout = setTimeout(
				() => controller.abort(),
				SEARCH_TIMEOUT_MS,
			);

			const response = await fetch(url, {
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
					Accept: "text/html",
				},
				signal: controller.signal,
			});

			clearTimeout(timeout);

			if (!response.ok) {
				return {
					toolCallId: "",
					content: `Search failed: HTTP ${response.status}`,
					isError: true,
				};
			}

			const html = await response.text();
			const results = parseSearchResults(html, maxResults);

			if (results.length === 0) {
				return {
					toolCallId: "",
					content: `No results found for "${query}".`,
					isError: false,
				};
			}

			const formatted = results
				.map(
					(r, i) =>
						`${i + 1}. ${r.title} — ${r.url}\n   ${r.snippet}`,
				)
				.join("\n");

			return {
				toolCallId: "",
				content: `Results for "${query}":\n${formatted}`,
				isError: false,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unknown error";
			if (message.includes("abort") || message.includes("Abort")) {
				return {
					toolCallId: "",
					content: "Search timed out. The device may be offline.",
					isError: true,
				};
			}
			return {
				toolCallId: "",
				content: `Search error: ${message}`,
				isError: true,
			};
		}
	},

	validate(args) {
		if (!args.query || String(args.query).trim().length === 0) {
			return "Query is required";
		}
		if (String(args.query).length > 500) {
			return "Query too long (max 500 chars)";
		}
		return null;
	},
};
