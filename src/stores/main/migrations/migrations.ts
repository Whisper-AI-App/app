import { createMigrations } from "@nanocollective/json-up";
import { z } from "zod";

/**
 * Type for TinyBase store state as JSON for json-up migrations.
 */
export type StoreState = {
	_version: number;
	values: Record<string, unknown>;
	tables: Record<string, Record<string, Record<string, unknown>>>;
};

/**
 * All migrations defined using json-up builder pattern.
 *
 * To add a new migration:
 * 1. Add a new .add() call with the next version number
 * 2. Define the schema for validation after migration
 * 3. Implement the up function to transform the data
 */
export const migrations = createMigrations()
	.add({
		version: 2, // version "1" was used in the pre-migration era, so we start at 2
		schema: z.object({
			values: z.object({
				version: z.string(),
				name: z.string().optional(),
				onboardedAt: z.string().optional(),
				theme: z.string().optional(),
				localAuthEnabled: z.boolean().optional(),
				// Model card data
				ai_chat_model_card: z.string().optional(),
				ai_chat_model_cardId: z.string().optional(),
				ai_chat_model_config_version: z.string().optional(),
				// Download state
				ai_chat_model_downloadedAt: z.string().optional(),
				ai_chat_model_filename: z.string().optional(),
				ai_chat_model_fileUri: z.string().optional(),
				ai_chat_model_progressSizeGB: z.number().optional(),
				ai_chat_model_downloadError: z.string().optional(),
				ai_chat_model_resumableState: z.string().optional(),
				ai_chat_model_isPaused: z.boolean().optional(),
				ai_chat_model_fileRemoved: z.boolean().optional(),
				// Chat background settings
				chat_background_type: z.string().optional(),
				chat_background_uri: z.string().optional(),
				chat_background_preset_id: z.string().optional(),
				chat_background_blur: z.number().optional(),
				chat_background_grain: z.number().optional(),
				chat_background_opacity: z.number().optional(),
				// Game high scores
				flappy_bird_high_score: z.number().optional(),
				// App icon customization
				app_icon_variant: z.string().optional(),
			}),
			tables: z.object({
				chats: z
					.record(
						z.string(),
						z.object({
							id: z.string(),
							name: z.string(),
							createdAt: z.string(),
							folderId: z.string(),
						}),
					)
					.optional()
					.default({}),
				messages: z
					.record(
						z.string(),
						z.object({
							id: z.string(),
							chatId: z.string(),
							contents: z.string(),
							role: z.string(),
							createdAt: z.string(),
						}),
					)
					.optional()
					.default({}),
				folders: z
					.record(
						z.string(),
						z.object({
							id: z.string(),
							name: z.string(),
							createdAt: z.string(),
						}),
					)
					.optional()
					.default({}),
			}),
		}),
		up: (input: unknown) => {
			const data = input as StoreState;
			const tables = data.tables ?? {};

			const str = (val: unknown, fallback: string) =>
				typeof val === "string" ? val : fallback;

			// Heal chats - ensure required fields exist
			const chats = Object.fromEntries(
				Object.entries(tables.chats ?? {}).map(([chatId, chat]) => [
					chatId,
					{
						id: str(chat.id, chatId),
						name: str(chat.name, "Untitled Chat"),
						createdAt: str(chat.createdAt, new Date().toISOString()),
						folderId: str(chat.folderId, ""),
					},
				]),
			);

			// Heal messages - ensure required fields exist
			const messages = Object.fromEntries(
				Object.entries(tables.messages ?? {}).map(([msgId, msg]) => [
					msgId,
					{
						id: str(msg.id, msgId),
						chatId: str(msg.chatId, ""),
						role: str(msg.role, "user"),
						contents: str(msg.contents, ""),
						createdAt: str(msg.createdAt, new Date().toISOString()),
					},
				]),
			);

			// Heal folders - ensure required fields exist
			const folders = Object.fromEntries(
				Object.entries(tables.folders ?? {}).map(([folderId, folder]) => [
					folderId,
					{
						id: str(folder.id, folderId),
						name: str(folder.name, "Untitled Folder"),
						createdAt: str(folder.createdAt, new Date().toISOString()),
					},
				]),
			);

			// Heal values - extract only known fields with correct types
			const values = data.values ?? {};
			const strVal = (key: string) => {
				const v = values[key];
				return typeof v === "string" ? v : undefined;
			};
			const numVal = (key: string) => {
				const v = values[key];
				return typeof v === "number" ? v : undefined;
			};
			const boolVal = (key: string) => {
				const v = values[key];
				return typeof v === "boolean" ? v : undefined;
			};

			return {
				values: {
					version: "2",
					name: strVal("name"),
					onboardedAt: strVal("onboardedAt"),
					theme: strVal("theme"),
					localAuthEnabled: boolVal("localAuthEnabled"),
					ai_chat_model_card: strVal("ai_chat_model_card"),
					ai_chat_model_cardId: strVal("ai_chat_model_cardId"),
					ai_chat_model_config_version: strVal("ai_chat_model_config_version"),
					ai_chat_model_downloadedAt: strVal("ai_chat_model_downloadedAt"),
					ai_chat_model_filename: strVal("ai_chat_model_filename"),
					ai_chat_model_fileUri: strVal("ai_chat_model_fileUri"),
					ai_chat_model_progressSizeGB: numVal("ai_chat_model_progressSizeGB"),
					ai_chat_model_downloadError: strVal("ai_chat_model_downloadError"),
					ai_chat_model_resumableState: strVal("ai_chat_model_resumableState"),
					ai_chat_model_isPaused: boolVal("ai_chat_model_isPaused"),
					ai_chat_model_fileRemoved: boolVal("ai_chat_model_fileRemoved"),
					chat_background_type: strVal("chat_background_type"),
					chat_background_uri: strVal("chat_background_uri"),
					chat_background_preset_id: strVal("chat_background_preset_id"),
					chat_background_blur: numVal("chat_background_blur"),
					chat_background_grain: numVal("chat_background_grain"),
					chat_background_opacity: numVal("chat_background_opacity"),
					flappy_bird_high_score: numVal("flappy_bird_high_score"),
					app_icon_variant: strVal("app_icon_variant"),
				},
				tables: {
					chats,
					messages,
					folders,
				},
			};
		},
	})
	// What version 3 may look like! Keeping for reference. Note we have a full schema of what version 3 looks like.
	// PLEASE REMOVE THIS WHEN A VERSION 3 MIGRATION IS MADE.
	// .add({
	// 	version: 3,
	// 	schema: z.object({
	// 		values: z.object({
	// 			version: z.string(),
	// 			name: z.string().optional(),
	// 			onboardedAt: z.string().optional(),
	// 			theme: z.string().optional(),
	// 			localAuthEnabled: z.boolean().optional(),
	// 			// Model card data
	// 			ai_chat_model_card: z.string().optional(),
	// 			ai_chat_model_cardId: z.string().optional(),
	// 			ai_chat_model_config_version: z.string().optional(),
	// 			// Download state
	// 			ai_chat_model_downloadedAt: z.string().optional(),
	// 			ai_chat_model_filename: z.string().optional(),
	// 			ai_chat_model_fileUri: z.string().optional(),
	// 			ai_chat_model_progressSizeGB: z.number().optional(),
	// 			ai_chat_model_downloadError: z.string().optional(),
	// 			ai_chat_model_resumableState: z.string().optional(),
	// 			ai_chat_model_isPaused: z.boolean().optional(),
	// 			ai_chat_model_fileRemoved: z.boolean().optional(),
	// 			// Chat background settings
	// 			chat_background_type: z.string().optional(),
	// 			chat_background_uri: z.string().optional(),
	// 			chat_background_preset_id: z.string().optional(),
	// 			chat_background_blur: z.number().optional(),
	// 			chat_background_grain: z.number().optional(),
	// 			chat_background_opacity: z.number().optional(),
	// 			// Game high scores
	// 			flappy_bird_high_score: z.number().optional(),
	// 			// App icon customization
	// 			app_icon_variant: z.string().optional(),
	// 		}),
	// 		tables: z.object({
	// 			chats: z
	// 				.record(
	// 					z.string(),
	// 					z.object({
	// 						id: z.string(),
	// 						name: z.string(),
	// 						createdAt: z.string(),
	// 						folderId: z.string(),
	// 					}),
	// 				)
	// 				.optional()
	// 				.default({}),
	// 			messages: z
	// 				.record(
	// 					z.string(),
	// 					z.object({
	// 						id: z.string(),
	// 						chatId: z.string(),
	// 						contents: z.string(),
	// 						role: z.string(),
	// 						createdAt: z.string(),
	// 					}),
	// 				)
	// 				.optional()
	// 				.default({}),
	// 			folders: z
	// 				.record(
	// 					z.string(),
	// 					z.object({
	// 						id: z.string(),
	// 						name: z.string(),
	// 						createdAt: z.string(),
	// 					}),
	// 				)
	// 				.optional()
	// 				.default({}),
	// 		}),
	// 	}),
	// 	up: (state) => {
	// 		return {
	// 			...state,
	// 			tables: {
	// 				...state.tables,
	// 			},
	// 			values: {
	// 				...state.values,
	// 			},
	// 		};
	// 	},
	// })
	.build();

export const CURRENT_SCHEMA_VERSION = migrations[migrations.length - 1].version; // Re-export for external use
