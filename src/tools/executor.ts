import type { ToolCall, ToolDefinition, ToolResult } from "./types";
import { toolRegistry } from "./registry";
import { validateToolCall, validateToolName } from "./validator";

const TOOL_EXECUTION_TIMEOUT_MS = 15000;

/**
 * Execute a list of tool calls with parallel read-only grouping.
 * Read-only tools in consecutive groups run in parallel.
 * Non-read-only tools run sequentially.
 */
export async function executeToolCalls(
	calls: ToolCall[],
): Promise<ToolResult[]> {
	const activeTools = toolRegistry.getActiveTools();
	const results: ToolResult[] = [];

	// Group consecutive calls by read-only status
	const groups = groupByReadOnly(calls, activeTools);

	for (const group of groups) {
		if (group.parallel) {
			// Execute all read-only tools in parallel
			const groupResults = await Promise.all(
				group.calls.map((call) => executeSingleToolCall(call, activeTools)),
			);
			results.push(...groupResults);
		} else {
			// Execute sequentially
			for (const call of group.calls) {
				const result = await executeSingleToolCall(call, activeTools);
				results.push(result);
			}
		}
	}

	return results;
}

async function executeSingleToolCall(
	call: ToolCall,
	activeTools: ToolDefinition[],
): Promise<ToolResult> {
	// Validate tool name
	const nameError = validateToolName(call.name, activeTools);
	if (nameError) {
		return {
			toolCallId: call.id,
			content: nameError,
			isError: true,
		};
	}

	const tool = toolRegistry.getTool(call.name);
	if (!tool) {
		return {
			toolCallId: call.id,
			content: `Tool not found: ${call.name}`,
			isError: true,
		};
	}

	// Validate arguments
	const validationError = validateToolCall(call, tool);
	if (validationError) {
		return validationError;
	}

	// Execute with timeout
	try {
		const result = await Promise.race([
			tool.execute(call.arguments),
			new Promise<ToolResult>((_, reject) =>
				setTimeout(
					() => reject(new Error("Tool execution timed out")),
					TOOL_EXECUTION_TIMEOUT_MS,
				),
			),
		]);

		return {
			...result,
			toolCallId: call.id,
		};
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unknown error during tool execution";
		return {
			toolCallId: call.id,
			content: `Error executing ${call.name}: ${message}`,
			isError: true,
		};
	}
}

interface ExecutionGroup {
	calls: ToolCall[];
	parallel: boolean;
}

function groupByReadOnly(
	calls: ToolCall[],
	activeTools: ToolDefinition[],
): ExecutionGroup[] {
	const groups: ExecutionGroup[] = [];
	let currentGroup: ToolCall[] = [];
	let currentIsReadOnly = false;

	for (const call of calls) {
		const tool = activeTools.find((t) => t.name === call.name);
		const isReadOnly = tool?.readOnly ?? false;

		if (currentGroup.length === 0) {
			currentIsReadOnly = isReadOnly;
			currentGroup.push(call);
		} else if (isReadOnly === currentIsReadOnly) {
			currentGroup.push(call);
		} else {
			groups.push({ calls: currentGroup, parallel: currentIsReadOnly });
			currentGroup = [call];
			currentIsReadOnly = isReadOnly;
		}
	}

	if (currentGroup.length > 0) {
		groups.push({ calls: currentGroup, parallel: currentIsReadOnly });
	}

	return groups;
}
