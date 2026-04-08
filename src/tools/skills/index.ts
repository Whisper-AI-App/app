import { toolRegistry } from "../registry";
import { internetSkill } from "./internet";

/**
 * Register all built-in skills with the tool registry.
 * Called at app startup.
 */
export function registerBuiltInSkills(): void {
	toolRegistry.registerSkill(internetSkill);
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
