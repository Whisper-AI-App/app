import { toolRegistry } from "../registry";
import type { Skill } from "../types";

/**
 * Register all built-in skills with the tool registry.
 * Called at app startup. Add new skills here as they're implemented.
 */
export function registerBuiltInSkills(): void {
	// No built-in skills yet — architecture is ready for them.
}

/**
 * Register a skill programmatically (for third-party or dynamically loaded skills).
 */
export function registerSkill(skill: Skill): void {
	toolRegistry.registerSkill(skill);
}

/**
 * Update skill enabled states from stored settings.
 */
export function syncSkillStates(enabledSkillIds: string[]): void {
	for (const skill of toolRegistry.getSkills()) {
		toolRegistry.setSkillEnabled(
			skill.id,
			enabledSkillIds.includes(skill.id),
		);
	}
}
