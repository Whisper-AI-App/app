import type { ToolCall, ToolDefinition, ToolResult } from "./types";

/**
 * Validate a tool call's arguments against the tool definition schema.
 * Returns null if valid, or a ToolResult with error if invalid.
 */
export function validateToolCall(
	call: ToolCall,
	tool: ToolDefinition,
): ToolResult | null {
	// Run custom validator if present
	if (tool.validate) {
		const error = tool.validate(call.arguments);
		if (error) {
			return {
				toolCallId: call.id,
				content: `Validation error for ${call.name}: ${error}`,
				isError: true,
			};
		}
	}

	// Validate required parameters
	for (const param of tool.parameters) {
		if (param.required) {
			const value = call.arguments[param.name];
			if (value === undefined || value === null) {
				return {
					toolCallId: call.id,
					content: `Missing required parameter: ${param.name}`,
					isError: true,
				};
			}
		}
	}

	// Validate parameter types
	for (const param of tool.parameters) {
		const value = call.arguments[param.name];
		if (value === undefined || value === null) continue;

		const actualType = typeof value;
		if (actualType !== param.type) {
			// Try coercion for common cases
			if (param.type === "number" && actualType === "string") {
				const num = Number(value);
				if (!Number.isNaN(num)) {
					call.arguments[param.name] = num;
					continue;
				}
			}
			if (param.type === "string" && (actualType === "number" || actualType === "boolean")) {
				call.arguments[param.name] = String(value);
				continue;
			}

			return {
				toolCallId: call.id,
				content: `Parameter "${param.name}" must be ${param.type}, got ${actualType}`,
				isError: true,
			};
		}

		// Validate enum values
		if (param.enum && param.type === "string") {
			if (!param.enum.includes(value as string)) {
				return {
					toolCallId: call.id,
					content: `Parameter "${param.name}" must be one of: ${param.enum.join(", ")}`,
					isError: true,
				};
			}
		}
	}

	return null;
}

/**
 * Validate that a tool call's name matches a known, active tool.
 * Returns an error message if the tool name is unknown.
 */
export function validateToolName(
	callName: string,
	availableTools: ToolDefinition[],
): string | null {
	const tool = availableTools.find((t) => t.name === callName);
	if (!tool) {
		const names = availableTools.map((t) => t.name).join(", ");
		return `Unknown tool: "${callName}". Available tools: ${names}`;
	}
	return null;
}
