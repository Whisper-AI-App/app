import type { ToolDefinition } from "../tools/types";

/**
 * Convert ToolDefinition[] to the OpenAI function-calling format
 * expected by llama.rn's `tools` parameter.
 */
export function convertToLlamaTools(
	tools: ToolDefinition[],
): Array<{
	type: "function";
	function: {
		name: string;
		description: string;
		parameters: {
			type: "object";
			properties: Record<string, unknown>;
			required: string[];
		};
	};
}> {
	return tools.map((t) => ({
		type: "function" as const,
		function: {
			name: t.name,
			description: t.description,
			parameters: {
				type: "object" as const,
				properties: Object.fromEntries(
					t.parameters.map((p) => [
						p.name,
						{
							type: p.type,
							description: p.description,
							...(p.enum ? { enum: p.enum } : {}),
						},
					]),
				),
				required: t.parameters
					.filter((p) => p.required)
					.map((p) => p.name),
			},
		},
	}));
}
