import type { ToolDefinition } from "./types";

/**
 * Format tool definitions into a compact system prompt section.
 * Optimized for small models — minimal token footprint.
 */
export function formatToolsForPrompt(tools: ToolDefinition[]): string {
	if (tools.length === 0) return "";

	const toolLines = tools.map((t) => {
		const params = t.parameters
			.map((p) => `${p.name}${p.required ? "" : "?"}: ${p.type}`)
			.join(", ");
		return `- ${t.name}(${params}) — ${t.description}`;
	});

	return `You have tools available. To use a tool, respond with XML:

<tool_call>
<name>tool_name</name>
<arguments>{"param": "value"}</arguments>
</tool_call>

Available tools:
${toolLines.join("\n")}

Only use tools when needed. After tool results, continue your response.`;
}

/**
 * Format few-shot examples for small model guidance.
 * Returns examples specific to the active tools.
 */
export function formatFewShotExamples(tools: ToolDefinition[]): string {
	const toolNames = new Set(tools.map((t) => t.name));
	const examples: string[] = [];

	if (toolNames.has("web_search")) {
		examples.push(`Example:
User: What's the weather in London?
Assistant: <tool_call>
<name>web_search</name>
<arguments>{"query": "weather in London today"}</arguments>
</tool_call>`);
	}

	if (toolNames.has("fetch_url")) {
		examples.push(`Example:
User: What does this page say? https://example.com
Assistant: <tool_call>
<name>fetch_url</name>
<arguments>{"url": "https://example.com"}</arguments>
</tool_call>`);
	}

	return examples.join("\n\n");
}

/**
 * Build the complete tool system prompt including definitions and examples.
 */
export function buildToolSystemPrompt(tools: ToolDefinition[]): string {
	if (tools.length === 0) return "";

	const definitions = formatToolsForPrompt(tools);
	const examples = formatFewShotExamples(tools);

	if (examples) {
		return `${definitions}\n\n${examples}`;
	}
	return definitions;
}
