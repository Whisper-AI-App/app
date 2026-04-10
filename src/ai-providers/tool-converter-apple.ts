import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "../tools/types";

/**
 * Convert ToolDefinition[] to a ToolSet for Apple Intelligence's createAppleProvider().
 *
 * Apple's native Foundation Models layer executes tools during generation
 * and feeds results back to the model automatically. So unlike other providers,
 * the execute functions are called by the provider, not the hook.
 */
// biome-ignore lint/suspicious/noExplicitAny: AI SDK ToolSet requires Tool<any,any>
export function convertToAppleTools(tools: ToolDefinition[]): Record<string, any> {
	// biome-ignore lint/suspicious/noExplicitAny: AI SDK ToolSet requires Tool<any,any>
	const result: Record<string, any> = {};

	for (const t of tools) {
		const shape: Record<string, z.ZodTypeAny> = {};

		for (const p of t.parameters) {
			let zodType: z.ZodTypeAny;
			switch (p.type) {
				case "number":
					zodType = z.number().describe(p.description);
					break;
				case "boolean":
					zodType = z.boolean().describe(p.description);
					break;
				default:
					zodType = z.string().describe(p.description);
					break;
			}
			if (!p.required) {
				zodType = zodType.optional();
			}
			shape[p.name] = zodType;
		}

		const toolDef = t;
		result[t.name] = tool({
			description: t.description,
			parameters: z.object(shape),
			execute: async (args: Record<string, unknown>) => {
				const execResult = await toolDef.execute(args);
				return execResult.content;
			},
			// biome-ignore lint/suspicious/noExplicitAny: required for AI SDK type compatibility
		} as any);
	}

	return result;
}
