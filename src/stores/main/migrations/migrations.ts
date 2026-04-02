import { createAsyncMigrations } from "@nanocollective/json-up";
import { z } from "zod";
import { setCredential } from "../../../actions/secure-credentials";
import { generateEncryptionKey, loadEncryptionKey } from "../encryption-key";

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
 *
 * IMPORTANT: NEVER use .passthrough() on Zod schemas in migrations.
 * Every field must be explicitly defined. Passthrough allows unknown
 * data to slip through, which defeats the purpose of schema validation
 * and can cause subtle data corruption across migration versions.
 */
export const migrations = createAsyncMigrations()
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
	.add({
		version: 3,
		schema: z.object({
			values: z.object({
				version: z.string(),
				name: z.string().optional(),
				onboardedAt: z.string().optional(),
				theme: z.string().optional(),
				localAuthEnabled: z.boolean().optional(),
				activeProviderId: z.string().optional(),
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
							providerId: z.string(),
							modelId: z.string(),
							status: z.string(),
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
				aiProviders: z
					.record(
						z.string(),
						z.object({
							id: z.string(),
							status: z.string(),
							error: z.string(),
							selectedModelId: z.string(),
							modelCard: z.string(),
							modelCardId: z.string(),
							configVersion: z.string(),
							downloadedAt: z.string(),
							filename: z.string(),
							progressSizeGB: z.number(),
							totalSizeGB: z.number(),
							downloadError: z.string(),
							resumableState: z.string(),
							isPaused: z.boolean(),
							fileRemoved: z.boolean(),
							apiKey: z.string(),
							oAuthCodeVerifier: z.string(),
							endpointUrl: z.string(),
							protocol: z.string(),
						}),
					)
					.optional()
					.default({}),
			}),
		}),
		up: (data) => {
			const values = data.values as Record<string, unknown>;
			const tables = data.tables;

			const strVal = (key: string): string => {
				const v = values[key];
				return typeof v === "string" ? v : "";
			};
			const numVal = (key: string): number => {
				const v = values[key];
				return typeof v === "number" ? v : 0;
			};
			const boolVal = (key: string): boolean => {
				const v = values[key];
				return typeof v === "boolean" ? v : false;
			};

			// --- Migrate ai_chat_model_* values into aiProviders table ---
			type ProviderRow = {
				id: string;
				status: string;
				error: string;
				selectedModelId: string;
				modelCard: string;
				modelCardId: string;
				configVersion: string;
				downloadedAt: string;
				filename: string;
				progressSizeGB: number;
				totalSizeGB: number;
				downloadError: string;
				resumableState: string;
				isPaused: boolean;
				fileRemoved: boolean;
				apiKey: string;
				oAuthCodeVerifier: string;
				endpointUrl: string;
				protocol: string;
			};
			const aiProviders: Record<string, ProviderRow> = {};

			const downloadedAt = strVal("ai_chat_model_downloadedAt");
			const filename = strVal("ai_chat_model_filename");
			const fileRemoved = boolVal("ai_chat_model_fileRemoved");
			const modelCard = strVal("ai_chat_model_card");

			// Only create whisper-ai row if there's any model data
			const hasModelData = !!(downloadedAt || filename || modelCard);

			if (hasModelData) {
				// Determine status
				let status: string;
				if (fileRemoved) {
					status = "needs_setup";
				} else if (downloadedAt) {
					status = "ready";
				} else if (filename) {
					status = "needs_setup";
				} else {
					status = "needs_setup";
				}

				// Parse model card to get totalSizeGB
				let totalSizeGB = 0;
				if (modelCard) {
					try {
						const card = JSON.parse(modelCard);
						totalSizeGB = card.sizeGB ?? 0;
					} catch {
						// ignore parse errors
					}
				}

				const modelCardId = strVal("ai_chat_model_cardId");
				aiProviders["whisper-ai"] = {
					id: "whisper-ai",
					status,
					error: "",
					selectedModelId: modelCardId,
					modelCard,
					modelCardId,
					configVersion: strVal("ai_chat_model_config_version"),
					downloadedAt,
					filename,
					progressSizeGB: numVal("ai_chat_model_progressSizeGB"),
					totalSizeGB,
					downloadError: strVal("ai_chat_model_downloadError"),
					resumableState: strVal("ai_chat_model_resumableState"),
					isPaused: boolVal("ai_chat_model_isPaused"),
					fileRemoved,
					apiKey: "",
					oAuthCodeVerifier: "",
					endpointUrl: "",
					protocol: "",
				};
			}

			// --- Set activeProviderId ---
			const activeProviderId =
				hasModelData && aiProviders["whisper-ai"]?.status === "ready"
					? "whisper-ai"
					: undefined;

			// --- Add providerId, modelId, and status to all existing messages ---
			const messages = Object.fromEntries(
				Object.entries(tables.messages ?? {}).map(([msgId, msg]) => [
					msgId,
					{
						...msg,
						providerId: "whisper-ai",
						modelId: "v0 model",
						status: "done",
					},
				]),
			);

			// --- Build new values without ai_chat_model_* keys ---
			const optStr = (key: string) => {
				const v = values[key];
				return typeof v === "string" ? v : undefined;
			};
			const optNum = (key: string) => {
				const v = values[key];
				return typeof v === "number" ? v : undefined;
			};
			const optBool = (key: string) => {
				const v = values[key];
				return typeof v === "boolean" ? v : undefined;
			};

			return {
				values: {
					version: "3",
					name: optStr("name"),
					onboardedAt: optStr("onboardedAt"),
					theme: optStr("theme"),
					localAuthEnabled: optBool("localAuthEnabled"),
					activeProviderId,
					chat_background_type: optStr("chat_background_type"),
					chat_background_uri: optStr("chat_background_uri"),
					chat_background_preset_id: optStr("chat_background_preset_id"),
					chat_background_blur: optNum("chat_background_blur"),
					chat_background_grain: optNum("chat_background_grain"),
					chat_background_opacity: optNum("chat_background_opacity"),
					flappy_bird_high_score: optNum("flappy_bird_high_score"),
					app_icon_variant: optStr("app_icon_variant"),
				},
				tables: {
					chats: tables.chats ?? {},
					messages,
					folders: tables.folders ?? {},
					aiProviders,
				},
			};
		},
	})
	.add({
		version: 4,
		schema: z.object({
			values: z.object({
				version: z.string(),
				name: z.string().optional(),
				onboardedAt: z.string().optional(),
				theme: z.string().optional(),
				localAuthEnabled: z.boolean().optional(),
				activeProviderId: z.string().optional(),
				chat_background_type: z.string().optional(),
				chat_background_uri: z.string().optional(),
				chat_background_preset_id: z.string().optional(),
				chat_background_blur: z.number().optional(),
				chat_background_grain: z.number().optional(),
				chat_background_opacity: z.number().optional(),
				flappy_bird_high_score: z.number().optional(),
				app_icon_variant: z.string().optional(),
				encryptionMigratedAt: z.string().optional(),
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
							providerId: z.string(),
							modelId: z.string(),
							status: z.string(),
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
				aiProviders: z
					.record(
						z.string(),
						z.object({
							id: z.string(),
							status: z.string(),
							error: z.string(),
							selectedModelId: z.string(),
							modelCard: z.string(),
							modelCardId: z.string(),
							configVersion: z.string(),
							downloadedAt: z.string(),
							filename: z.string(),
							progressSizeGB: z.number(),
							totalSizeGB: z.number(),
							downloadError: z.string(),
							resumableState: z.string(),
							isPaused: z.boolean(),
							fileRemoved: z.boolean(),
							endpointUrl: z.string(),
							protocol: z.string(),
						}),
					)
					.optional()
					.default({}),
			}),
		}),
		up: async (data) => {
			// v4: Generate encryption key, move credentials to secure store,
			// heal aiProviders rows, add encryptionMigratedAt.

			// Generate encryption key if not already present
			const existingKey = await loadEncryptionKey();
			if (!existingKey) {
				await generateEncryptionKey();
			}

			// Heal aiProviders and move credentials to secure store
			const aiProviders = Object.fromEntries(
				await Promise.all(
					Object.entries(
						(data.tables.aiProviders ?? {}) as Record<
							string,
							Record<string, unknown>
						>,
					).map(async ([id, row]) => {
						const apiKey = typeof row.apiKey === "string" ? row.apiKey : "";
						const oAuthCodeVerifier =
							typeof row.oAuthCodeVerifier === "string"
								? row.oAuthCodeVerifier
								: "";

						// Move credentials to secure store
						if (apiKey) {
							await setCredential(id, "apiKey", apiKey);
						}
						if (oAuthCodeVerifier) {
							await setCredential(id, "oAuthCodeVerifier", oAuthCodeVerifier);
						}

						return [
							id,
							{
								id: typeof row.id === "string" ? row.id : id,
								status: typeof row.status === "string" ? row.status : "",
								error: typeof row.error === "string" ? row.error : "",
								selectedModelId:
									typeof row.selectedModelId === "string"
										? row.selectedModelId
										: "",
								modelCard:
									typeof row.modelCard === "string" ? row.modelCard : "",
								modelCardId:
									typeof row.modelCardId === "string" ? row.modelCardId : "",
								configVersion:
									typeof row.configVersion === "string"
										? row.configVersion
										: "",
								downloadedAt:
									typeof row.downloadedAt === "string" ? row.downloadedAt : "",
								filename: typeof row.filename === "string" ? row.filename : "",
								progressSizeGB:
									typeof row.progressSizeGB === "number"
										? row.progressSizeGB
										: 0,
								totalSizeGB:
									typeof row.totalSizeGB === "number" ? row.totalSizeGB : 0,
								downloadError:
									typeof row.downloadError === "string"
										? row.downloadError
										: "",
								resumableState:
									typeof row.resumableState === "string"
										? row.resumableState
										: "",
								isPaused:
									typeof row.isPaused === "boolean" ? row.isPaused : false,
								fileRemoved:
									typeof row.fileRemoved === "boolean"
										? row.fileRemoved
										: false,
								endpointUrl:
									typeof row.endpointUrl === "string" ? row.endpointUrl : "",
								protocol: typeof row.protocol === "string" ? row.protocol : "",
							},
						] as const;
					}),
				),
			);

			return {
				...data,
				values: {
					...data.values,
					version: "4",
					encryptionMigratedAt: new Date().toISOString(),
				},
				tables: {
					chats: data.tables.chats ?? {},
					// Heal messages: rows created after v3 may lack providerId/modelId/status
					messages: Object.fromEntries(
						Object.entries(data.tables.messages ?? {}).map(([msgId, msg]) => [
							msgId,
							{
								...msg,
								providerId:
									typeof (msg as Record<string, unknown>).providerId ===
									"string"
										? (msg as Record<string, unknown>).providerId
										: "",
								modelId:
									typeof (msg as Record<string, unknown>).modelId === "string"
										? (msg as Record<string, unknown>).modelId
										: "",
								status:
									typeof (msg as Record<string, unknown>).status === "string"
										? (msg as Record<string, unknown>).status
										: "done",
							},
						]),
					),
					folders: data.tables.folders ?? {},
					aiProviders,
				},
			};
		},
	})
	.add({
		version: 5,
		schema: z.object({
			values: z.object({
				version: z.string(),
				name: z.string().optional(),
				onboardedAt: z.string().optional(),
				theme: z.string().optional(),
				localAuthEnabled: z.boolean().optional(),
				activeProviderId: z.string().optional(),
				chat_background_type: z.string().optional(),
				chat_background_uri: z.string().optional(),
				chat_background_preset_id: z.string().optional(),
				chat_background_blur: z.number().optional(),
				chat_background_grain: z.number().optional(),
				chat_background_opacity: z.number().optional(),
				flappy_bird_high_score: z.number().optional(),
				app_icon_variant: z.string().optional(),
				encryptionMigratedAt: z.string().optional(),
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
							providerId: z.string(),
							modelId: z.string(),
							status: z.string(),
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
				aiProviders: z
					.record(
						z.string(),
						z.object({
							id: z.string(),
							status: z.string(),
							error: z.string(),
							selectedModelId: z.string(),
							modelCard: z.string(),
							modelCardId: z.string(),
							configVersion: z.string(),
							downloadedAt: z.string(),
							filename: z.string(),
							progressSizeGB: z.number(),
							totalSizeGB: z.number(),
							downloadError: z.string(),
							resumableState: z.string(),
							isPaused: z.union([z.boolean(), z.number()]),
							fileRemoved: z.union([z.boolean(), z.number()]),
							mmprojFilename: z.string(),
							endpointUrl: z.string().optional(),
							protocol: z.string().optional(),
							capabilitiesVersion: z.number().optional(),
						}),
					)
					.optional()
					.default({}),
				attachments: z
					.record(
						z.string(),
						z.object({
							id: z.string(),
							messageId: z.string(),
							type: z.string(),
							uri: z.string(),
							mimeType: z.string(),
							fileName: z.string(),
							fileSize: z.number(),
							width: z.number(),
							height: z.number(),
							duration: z.number(),
							alt: z.string(),
							thumbnailUri: z.string(),
							createdAt: z.string(),
						}),
					)
					.optional()
					.default({}),
			}),
		}),
		up: (data) => {
			// v5: Add attachments table, mmprojFilename and capabilitiesVersion to aiProviders rows
			const aiProviders = Object.fromEntries(
				Object.entries(
					(data.tables.aiProviders ?? {}) as Record<
						string,
						Record<string, unknown>
					>,
				).map(([id, row]) => {
					return [
						id,
						{
							id: typeof row.id === "string" ? row.id : id,
							status: typeof row.status === "string" ? row.status : "",
							error: typeof row.error === "string" ? row.error : "",
							selectedModelId:
								typeof row.selectedModelId === "string"
									? row.selectedModelId
									: "",
							modelCard: typeof row.modelCard === "string" ? row.modelCard : "",
							modelCardId:
								typeof row.modelCardId === "string" ? row.modelCardId : "",
							configVersion:
								typeof row.configVersion === "string" ? row.configVersion : "",
							downloadedAt:
								typeof row.downloadedAt === "string" ? row.downloadedAt : "",
							filename: typeof row.filename === "string" ? row.filename : "",
							progressSizeGB:
								typeof row.progressSizeGB === "number" ? row.progressSizeGB : 0,
							totalSizeGB:
								typeof row.totalSizeGB === "number" ? row.totalSizeGB : 0,
							downloadError:
								typeof row.downloadError === "string" ? row.downloadError : "",
							resumableState:
								typeof row.resumableState === "string"
									? row.resumableState
									: "",
							isPaused:
								typeof row.isPaused === "boolean" ||
								typeof row.isPaused === "number"
									? row.isPaused
									: false,
							fileRemoved:
								typeof row.fileRemoved === "boolean" ||
								typeof row.fileRemoved === "number"
									? row.fileRemoved
									: false,
							mmprojFilename: "",
							endpointUrl:
								typeof row.endpointUrl === "string"
									? row.endpointUrl
									: undefined,
							protocol:
								typeof row.protocol === "string" ? row.protocol : undefined,
							capabilitiesVersion: 0,
						},
					];
				}),
			);

			return {
				values: {
					...(data.values as Record<string, unknown>),
					version: "5",
				},
				tables: {
					chats: data.tables.chats ?? {},
					messages: data.tables.messages ?? {},
					folders: data.tables.folders ?? {},
					aiProviders,
					attachments: {},
				},
			};
		},
	})
	.add({
		version: 6,
		schema: z.object({
			values: z.object({
				version: z.string(),
				name: z.string().optional(),
				onboardedAt: z.string().optional(),
				theme: z.string().optional(),
				localAuthEnabled: z.boolean().optional(),
				activeProviderId: z.string().optional(),
				chat_background_type: z.string().optional(),
				chat_background_uri: z.string().optional(),
				chat_background_preset_id: z.string().optional(),
				chat_background_blur: z.number().optional(),
				chat_background_grain: z.number().optional(),
				chat_background_opacity: z.number().optional(),
				flappy_bird_high_score: z.number().optional(),
				app_icon_variant: z.string().optional(),
				encryptionMigratedAt: z.string().optional(),
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
							providerId: z.string(),
							modelId: z.string(),
							status: z.string(),
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
				aiProviders: z
					.record(
						z.string(),
						z.object({
							id: z.string(),
							status: z.string(),
							error: z.string(),
							selectedModelId: z.string(),
							modelCard: z.string(),
							modelCardId: z.string(),
							configVersion: z.string(),
							downloadedAt: z.string(),
							filename: z.string(),
							progressSizeGB: z.number(),
							totalSizeGB: z.number(),
							downloadError: z.string(),
							resumableState: z.string(),
							isPaused: z.union([z.boolean(), z.number()]),
							fileRemoved: z.union([z.boolean(), z.number()]),
							mmprojFilename: z.string(),
							endpointUrl: z.string().optional(),
							protocol: z.string().optional(),
							capabilitiesVersion: z.number().optional(),
							downloadQueue: z.string().optional(),
						}),
					)
					.optional()
					.default({}),
				attachments: z
					.record(
						z.string(),
						z.object({
							id: z.string(),
							messageId: z.string(),
							type: z.string(),
							uri: z.string(),
							mimeType: z.string(),
							fileName: z.string(),
							fileSize: z.number(),
							width: z.number(),
							height: z.number(),
							duration: z.number(),
							alt: z.string(),
							thumbnailUri: z.string(),
							createdAt: z.string(),
						}),
					)
					.optional()
					.default({}),
				hfModels: z
					.record(
						z.string(),
						z.object({
							id: z.string(),
							repoId: z.string(),
							filename: z.string(),
							displayName: z.string(),
							fileSizeBytes: z.number(),
							parametersB: z.number(),
							quantization: z.string(),
							pipelineTag: z.string(),
							sha256: z.string(),
							localFilename: z.string(),
							downloadedAt: z.string(),
							downloadUrl: z.string(),
							mmprojFilename: z.string(),
							mmprojDownloadUrl: z.string(),
							mmprojSizeBytes: z.number(),
							mmprojLocalFilename: z.string(),
							mmprojDownloadedAt: z.string(),
							contextLength: z.number(),
						}),
					)
					.optional()
					.default({}),
			}),
		}),
		up: (data) => {
			// v6: Add hfModels table, add downloadQueue to aiProviders.
			const aiProviders = Object.fromEntries(
				Object.entries(data.tables.aiProviders ?? {}).map(([id, row]) => [
					id,
					{
						...row,
						downloadQueue: "",
					},
				]),
			);

			return {
				values: {
					...data.values,
					version: "6",
				},
				tables: {
					...data.tables,
					aiProviders,
					hfModels: {},
				},
			};
		},
	})
	.build();

export const CURRENT_SCHEMA_VERSION = migrations[migrations.length - 1].version;
