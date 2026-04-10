// ─── Core Tool Types ─────────────────────────────────────────

export interface ToolParameter {
	name: string;
	type: "string" | "number" | "boolean";
	description: string;
	required: boolean;
	enum?: string[];
}

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: ToolParameter[];
	readOnly: boolean;
	needsConfirmation?: boolean;
	execute: (args: Record<string, unknown>) => Promise<ToolResult>;
	validate?: (args: Record<string, unknown>) => string | null;
}

export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

export interface ToolResult {
	toolCallId: string;
	content: string;
	isError: boolean;
}

export interface Skill {
	id: string;
	name: string;
	description: string;
	version: string;
	tools: ToolDefinition[];
	enabled: boolean;
}

// ─── Provider Tool Capabilities ──────────────────────────────

export interface ToolCapabilities {
	/** Whether this provider/model combo supports tools at all */
	supported: boolean;
	/** Native API-level tool calling (structured responses) */
	nativeToolCalling: boolean;
	/** Falls back to prompt-injected XML tool definitions */
	promptFallback: boolean;
	/** Max tools that can be active (context budget) */
	maxActiveTools: number;
	/** Whether parallel tool calls are supported */
	parallelCalls: boolean;
}

export const NO_TOOL_SUPPORT: ToolCapabilities = {
	supported: false,
	nativeToolCalling: false,
	promptFallback: false,
	maxActiveTools: 0,
	parallelCalls: false,
};
