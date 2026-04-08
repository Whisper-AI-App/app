import type { ToolDefinition } from "./types";

/**
 * Build a correction prompt when the model produces a malformed tool call.
 */
export function buildCorrectionPrompt(
	malformedPattern: string,
	availableTools: ToolDefinition[],
): string {
	const toolNames = availableTools.map((t) => t.name).join(", ");

	return `Your previous tool call was not valid. ${malformedPattern}

Correct format:
<tool_call>
<name>tool_name</name>
<arguments>{"param": "value"}</arguments>
</tool_call>

Available tools: ${toolNames}
Please try again or respond without using tools.`;
}

/**
 * Build a tool result message to inject back into the conversation.
 * Formats tool results compactly for small model context budgets.
 */
export function formatToolResultsForModel(
	results: Array<{ toolName: string; content: string; isError: boolean }>,
): string {
	return results
		.map((r) => {
			const prefix = r.isError ? "[Error] " : "";
			return `[${r.toolName}] ${prefix}${r.content}`;
		})
		.join("\n\n");
}

/**
 * Truncate tool result content to fit within token budget.
 * Approximate: 1 token ~= 4 chars.
 */
export function truncateToolResult(
	content: string,
	maxChars: number,
): string {
	if (content.length <= maxChars) return content;
	return `${content.slice(0, maxChars)}\n\n[Content truncated — ${content.length - maxChars} characters omitted]`;
}
