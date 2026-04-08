import type { ToolDefinition, Skill } from "./types";

class ToolRegistry {
	private tools: Map<string, ToolDefinition> = new Map();
	private skills: Map<string, Skill> = new Map();

	registerSkill(skill: Skill): void {
		this.skills.set(skill.id, skill);
		for (const tool of skill.tools) {
			this.tools.set(tool.name, tool);
		}
	}

	unregisterSkill(skillId: string): void {
		const skill = this.skills.get(skillId);
		if (skill) {
			for (const tool of skill.tools) {
				this.tools.delete(tool.name);
			}
			this.skills.delete(skillId);
		}
	}

	registerTool(tool: ToolDefinition): void {
		this.tools.set(tool.name, tool);
	}

	unregisterTool(name: string): void {
		this.tools.delete(name);
	}

	getTools(): ToolDefinition[] {
		return Array.from(this.tools.values());
	}

	getActiveTools(): ToolDefinition[] {
		const activeTools: ToolDefinition[] = [];
		for (const skill of this.skills.values()) {
			if (skill.enabled) {
				for (const tool of skill.tools) {
					activeTools.push(tool);
				}
			}
		}
		return activeTools;
	}

	getTool(name: string): ToolDefinition | undefined {
		return this.tools.get(name);
	}

	getSkills(): Skill[] {
		return Array.from(this.skills.values());
	}

	getSkill(skillId: string): Skill | undefined {
		return this.skills.get(skillId);
	}

	setSkillEnabled(skillId: string, enabled: boolean): void {
		const skill = this.skills.get(skillId);
		if (skill) {
			skill.enabled = enabled;
		}
	}

	/** Format tool definitions for system prompt injection (compact XML format) */
	getToolPrompt(): string {
		const activeTools = this.getActiveTools();
		if (activeTools.length === 0) return "";
		return formatToolsForPrompt(activeTools);
	}
}

function formatToolsForPrompt(tools: ToolDefinition[]): string {
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

// Singleton instance
export const toolRegistry = new ToolRegistry();
