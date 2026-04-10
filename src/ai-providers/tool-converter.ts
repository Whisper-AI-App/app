import { tool } from "ai";
import { z } from "zod";
import type { ToolDefinition } from "../tools/types";

/**
 * Convert our ToolDefinition[] to the format expected by Vercel AI SDK's streamText().
 * Tools are created WITHOUT execute functions — execution is handled by the
 * useChatCompletion hook after the model returns tool calls.
 */
export function convertToAISDKTools(
	tools: ToolDefinition[],
): Record<string, ReturnType<typeof tool>> {
	const result: Record<string, ReturnType<typeof tool>> = {};

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
					zodType = p.enum
						? z.enum(p.enum as [string, ...string[]]).describe(p.description)
						: z.string().describe(p.description);
					break;
			}

			if (!p.required) {
				zodType = zodType.optional();
			}

			shape[p.name] = zodType;
		}

		result[t.name] = tool({
			description: t.description,
			parameters: z.object(shape),
		});
	}

	return result;
}
