import type { ToolCall } from "./types";

/** Result of parsing a model response for tool calls */
export interface ParseResult {
	/** Tool calls extracted from the response */
	toolCalls: ToolCall[];
	/** Response text with tool call XML stripped */
	textContent: string;
	/** Whether any malformed tool calls were detected */
	hasMalformed: boolean;
	/** Description of the malformed pattern (for error correction) */
	malformedPattern?: string;
}

const TOOL_CALL_REGEX =
	/<tool_call>\s*<name>([\s\S]*?)<\/name>\s*<arguments>([\s\S]*?)<\/arguments>\s*<\/tool_call>/g;

// Detect incomplete/malformed tool call patterns
const INCOMPLETE_TOOL_CALL = /<tool_call>(?![\s\S]*<\/tool_call>)/;
const HALLUCINATED_PATTERNS = [
	/\[tool:\s*\w+/i,
	/<function=\w+/i,
	/```tool_call/i,
	/\{?\s*"tool_call"\s*:/,
];

let nextToolCallId = 1;

function generateToolCallId(): string {
	return `tc_${Date.now()}_${nextToolCallId++}`;
}

/**
 * Parse tool calls from model output text (XML fallback path).
 * Extracts <tool_call> blocks and returns remaining text content.
 */
export function parseToolCallsFromText(text: string): ParseResult {
	const toolCalls: ToolCall[] = [];
	let hasMalformed = false;
	let malformedPattern: string | undefined;

	// Extract valid tool calls
	TOOL_CALL_REGEX.lastIndex = 0;
	let match = TOOL_CALL_REGEX.exec(text);
	while (match !== null) {
		const name = match[1].trim();
		const argsStr = match[2].trim();

		try {
			const args = JSON.parse(argsStr);
			if (typeof args === "object" && args !== null && !Array.isArray(args)) {
				toolCalls.push({
					id: generateToolCallId(),
					name,
					arguments: args as Record<string, unknown>,
				});
			} else {
				hasMalformed = true;
				malformedPattern = "Arguments must be a JSON object";
			}
		} catch {
			hasMalformed = true;
			malformedPattern = `Invalid JSON in arguments: ${argsStr.slice(0, 100)}`;
		}
		match = TOOL_CALL_REGEX.exec(text);
	}

	// Strip tool call XML from displayed text
	const textContent = text.replace(TOOL_CALL_REGEX, "").trim();

	// Check for malformed patterns if no valid tool calls found
	if (toolCalls.length === 0) {
		if (INCOMPLETE_TOOL_CALL.test(text)) {
			hasMalformed = true;
			malformedPattern = "Incomplete tool call — missing closing </tool_call> tag";
		} else {
			for (const pattern of HALLUCINATED_PATTERNS) {
				if (pattern.test(text)) {
					hasMalformed = true;
					malformedPattern =
						"Incorrect tool call format detected. Use <tool_call><name>...</name><arguments>...</arguments></tool_call>";
					break;
				}
			}
		}
	}

	return { toolCalls, textContent, hasMalformed, malformedPattern };
}

/**
 * Parse native tool calls from llama.rn NativeCompletionResult.
 * Normalizes the llama.rn format to our ToolCall type.
 */
export function parseNativeToolCalls(
	nativeToolCalls: Array<{
		type?: string;
		function?: { name: string; arguments: string };
		id?: string;
	}>,
): ToolCall[] {
	const toolCalls: ToolCall[] = [];

	for (const ntc of nativeToolCalls) {
		if (ntc.function?.name) {
			let args: Record<string, unknown> = {};
			try {
				const parsed = JSON.parse(ntc.function.arguments);
				if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
					args = parsed;
				}
			} catch {
				// Keep empty args — will be caught by validator
			}

			toolCalls.push({
				id: ntc.id || generateToolCallId(),
				name: ntc.function.name,
				arguments: args,
			});
		}
	}

	return toolCalls;
}

/**
 * Check if a tool call appears inside a markdown code block (model explaining, not calling).
 */
export function isToolCallInCodeBlock(text: string): boolean {
	const codeBlockRegex = /```[\s\S]*?```/g;
	codeBlockRegex.lastIndex = 0;
	let match = codeBlockRegex.exec(text);
	while (match !== null) {
		if (match[0].includes("<tool_call>")) {
			return true;
		}
		match = codeBlockRegex.exec(text);
	}
	return false;
}
