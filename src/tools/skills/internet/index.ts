import type { Skill } from "../../types";
import { webSearchTool } from "./web-search";
import { fetchUrlTool } from "./fetch-url";

export const internetSkill: Skill = {
	id: "internet",
	name: "Internet",
	description: "Search the web and fetch webpage content.",
	version: "1.0.0",
	tools: [webSearchTool, fetchUrlTool],
	enabled: true,
};
