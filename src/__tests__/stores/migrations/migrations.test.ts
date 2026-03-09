import * as SecureStore from "expo-secure-store";
import { getCredential } from "@/src/actions/secure-credentials";
import { createTestStore, getStoreSnapshot } from "./helpers";

// Mock expo-file-system (new API)
jest.mock("expo-file-system", () => ({
	writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
	Directory: jest.fn().mockImplementation(() => ({
		uri: "file:///mock/documents",
	})),
	Paths: { document: "file:///mock/documents" },
}));

// Mock main-store to avoid import side effects
jest.mock("../../../stores/main/main-store", () => ({
	mainStoreFilePath: "file:///mock/documents/whisper.json",
}));

jest.mock("expo-secure-store");
jest.mock("expo-crypto");

const { __resetStore } = SecureStore as typeof SecureStore & {
	__resetStore: () => void;
};

import { migrateAsync } from "@nanocollective/json-up";
import { runMigrations } from "../../../stores/main/migrations";
import {
	CURRENT_SCHEMA_VERSION,
	migrations,
} from "../../../stores/main/migrations/migrations";
import {
	tablesSchemaMainStore,
	valuesSchemaMainStore,
} from "../../../stores/main/schema";

beforeEach(() => {
	__resetStore();
	jest.clearAllMocks();
});

describe("migrations", () => {
	describe("runMigrations", () => {
		it("skips when already at current version", async () => {
			const store = createTestStore({
				values: {
					version: String(CURRENT_SCHEMA_VERSION),
					onboardedAt: "2024-01-01T00:00:00Z",
					activeProviderId: "whisper-ai",
				},
				tables: {
					aiProviders: {
						"whisper-ai": {
							id: "whisper-ai",
							status: "ready",
							downloadedAt: "2024-01-02T00:00:00Z",
							filename: "model.gguf",
						},
					},
				},
			});

			const result = await runMigrations(store);

			expect(result.success).toBe(true);
			expect(result.migrationsRun).toBe(0);
			expect(result.fromVersion).toBe(CURRENT_SCHEMA_VERSION);
			expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
			expect(store.getValue("onboardedAt")).toBe("2024-01-01T00:00:00Z");
			expect(store.getValue("activeProviderId")).toBe("whisper-ai");
		});

		it("treats missing version as version 0", async () => {
			const store = createTestStore({
				values: {},
				tables: { chats: {}, messages: {}, folders: {} },
			});

			const result = await runMigrations(store);

			expect(result.success).toBe(true);
			expect(result.fromVersion).toBe(0);
			expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
		});

		it("treats legacy version 1 as version 0", async () => {
			const store = createTestStore({
				values: { version: "1" },
				tables: { chats: {}, messages: {}, folders: {} },
			});

			const result = await runMigrations(store);

			expect(result.success).toBe(true);
			expect(result.fromVersion).toBe(0);
			expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
		});

		it("handles empty tables gracefully", async () => {
			const store = createTestStore({
				values: {},
				tables: { chats: {}, messages: {}, folders: {} },
			});

			const result = await runMigrations(store);

			expect(result.success).toBe(true);
			expect(store.getValue("version")).toBe(String(CURRENT_SCHEMA_VERSION));
		});

		it("handles completely empty store", async () => {
			const store = createTestStore({});

			const result = await runMigrations(store);
			expect(result.success).toBe(true);
		});

		it("preserves data integrity through migration", async () => {
			const store = createTestStore({
				values: {},
				tables: {
					chats: {
						"chat-1": {
							id: "chat-1",
							name: "Old Chat",
							createdAt: "2024-01-01T00:00:00Z",
							folderId: "",
						},
					},
					messages: {
						"msg-1": {
							id: "msg-1",
							chatId: "chat-1",
							contents: "Hello",
							role: "user",
							createdAt: "2024-01-01T00:00:00Z",
						},
					},
					folders: {
						"folder-1": {
							id: "folder-1",
							name: "My Folder",
							createdAt: "2024-01-01T00:00:00Z",
						},
					},
				},
			});

			const beforeSnapshot = getStoreSnapshot(store);
			const result = await runMigrations(store);

			expect(result.success).toBe(true);

			const chat = store.getRow("chats", "chat-1");
			expect(chat?.name).toBe(beforeSnapshot.tables?.chats?.["chat-1"]?.name);
			expect(chat?.id).toBe("chat-1");
		});
	});

	// ── Healing tests ─────────────────────────────────────────────────────────

	const TABLE_SEEDS = [
		{
			table: "chats",
			rowId: "row-1",
			sparseRow: { name: "Test Chat" }, // missing id, createdAt, folderId
			fullRow: {
				id: "row-1",
				name: "My Chat",
				createdAt: "2024-01-15T10:30:00Z",
				folderId: "f-1",
			},
			requiredFields: ["id", "name", "createdAt", "folderId"],
		},
		{
			table: "messages",
			rowId: "row-1",
			sparseRow: { contents: "Hello" }, // missing id, chatId, role, createdAt, providerId, modelId
			fullRow: {
				id: "row-1",
				chatId: "c-1",
				contents: "Hi",
				role: "assistant",
				createdAt: "2024-01-15T10:30:00Z",
				status: "done",
				providerId: "whisper-ai",
				modelId: "v0 model",
			},
			requiredFields: [
				"id",
				"chatId",
				"contents",
				"role",
				"createdAt",
				"status",
				"providerId",
				"modelId",
			],
		},
		{
			table: "folders",
			rowId: "row-1",
			sparseRow: { name: "Work" }, // missing id, createdAt
			fullRow: {
				id: "row-1",
				name: "Personal",
				createdAt: "2024-01-15T10:30:00Z",
			},
			requiredFields: ["id", "name", "createdAt"],
		},
	];

	it.each(TABLE_SEEDS)(
		"heals all missing fields in $table",
		async ({ table, rowId, sparseRow, requiredFields }) => {
			const store = createTestStore({
				tables: { [table]: { [rowId]: sparseRow } },
			});
			await runMigrations(store);
			const row = store.getRow(table, rowId);
			for (const field of requiredFields) {
				expect(row[field]).toBeDefined();
			}
		},
	);

	it.each(TABLE_SEEDS)(
		"preserves existing valid data in $table",
		async ({ table, rowId, fullRow }) => {
			const store = createTestStore({
				tables: { [table]: { [rowId]: fullRow } },
			});
			await runMigrations(store);
			const row = store.getRow(table, rowId);
			for (const [key, value] of Object.entries(fullRow)) {
				expect(row[key]).toBe(value);
			}
		},
	);
});

// ─── Schema-sync test ─────────────────────────────────────────────────────────

describe("migration schema sync", () => {
	it("migration schema and store schema are in sync — add a migration if this fails", () => {
		const latestMigration = migrations[migrations.length - 1];
		const { values: valuesZod, tables: tablesZod } =
			latestMigration.schema.shape;

		expect(new Set(Object.keys(valuesZod.shape))).toEqual(
			new Set(Object.keys(valuesSchemaMainStore)),
		);

		const migrationTables = new Set(Object.keys(tablesZod.shape));
		const storeTables = new Set(Object.keys(tablesSchemaMainStore));
		expect(migrationTables).toEqual(storeTables);

		for (const tableName of storeTables) {
			// biome-ignore lint/suspicious/noExplicitAny: Zod's wrapped types require dynamic access
			const tableRecord = (tablesZod.shape[tableName] as any)
				.removeDefault()
				.unwrap();
			const valueType = tableRecord._zod.def.valueType;
			const migrationCells = Object.keys(valueType.shape);
			const storeCells = Object.keys(
				tablesSchemaMainStore[tableName as keyof typeof tablesSchemaMainStore],
			);
			expect(new Set(migrationCells)).toEqual(new Set(storeCells));
		}
	});
});

// ─── V3 migration isolated tests ─────────────────────────────────────────────

describe("V3 migration", () => {
	/**
	 * Helper: creates a version-2 store with the given ai_chat_model_* values
	 * and optional tables, then runs migrations and returns the result.
	 */
	async function migrateFromV2(opts: {
		modelValues?: Record<string, unknown>;
		otherValues?: Record<string, unknown>;
		tables?: Record<string, Record<string, Record<string, unknown>>>;
	}) {
		const store = createTestStore({
			values: {
				version: "2",
				...(opts.otherValues ?? {}),
				...(opts.modelValues ?? {}),
			},
			tables: opts.tables ?? {},
		});
		const result = await runMigrations(store);
		return { store, result };
	}

	// ── T1.1: fileRemoved=true => status "needs_setup" ────────────────────

	it("sets status to needs_setup when fileRemoved is true", async () => {
		const { store } = await migrateFromV2({
			modelValues: {
				ai_chat_model_downloadedAt: "2024-06-01T00:00:00Z",
				ai_chat_model_filename: "model.gguf",
				ai_chat_model_fileRemoved: true,
			},
		});

		const provider = store.getRow("aiProviders", "whisper-ai");
		expect(provider.status).toBe("needs_setup");
	});

	// ── T1.2: downloadedAt present (not fileRemoved) => status "ready" ───

	it("sets status to ready when downloadedAt is present and fileRemoved is false", async () => {
		const { store } = await migrateFromV2({
			modelValues: {
				ai_chat_model_downloadedAt: "2024-06-01T00:00:00Z",
				ai_chat_model_filename: "model.gguf",
			},
		});

		const provider = store.getRow("aiProviders", "whisper-ai");
		expect(provider.status).toBe("ready");
	});

	// ── T1.3: only filename (no downloadedAt) => status "needs_setup" ────

	it("sets status to needs_setup when only filename is present", async () => {
		const { store } = await migrateFromV2({
			modelValues: {
				ai_chat_model_filename: "partial-model.gguf",
			},
		});

		const provider = store.getRow("aiProviders", "whisper-ai");
		expect(provider.status).toBe("needs_setup");
	});

	// ── T1.4: no model data => no whisper-ai row ─────────────────────────

	it("does not create whisper-ai row when no model data exists", async () => {
		const { store } = await migrateFromV2({
			modelValues: {},
			otherValues: { onboardedAt: "2024-01-01T00:00:00Z" },
		});

		const provider = store.getRow("aiProviders", "whisper-ai");
		// Row should be empty (no cells)
		expect(Object.keys(provider)).toHaveLength(0);
	});

	// ── T1.5: activeProviderId set to "whisper-ai" when status is "ready" ─

	it("sets activeProviderId to whisper-ai when status is ready", async () => {
		const { store } = await migrateFromV2({
			modelValues: {
				ai_chat_model_downloadedAt: "2024-06-01T00:00:00Z",
				ai_chat_model_filename: "model.gguf",
			},
		});

		expect(store.getValue("activeProviderId")).toBe("whisper-ai");
	});

	// ── T1.6: activeProviderId undefined when status is not "ready" ──────

	it("does not set activeProviderId when status is needs_setup", async () => {
		const { store } = await migrateFromV2({
			modelValues: {
				ai_chat_model_filename: "model.gguf",
			},
		});

		expect(store.getValue("activeProviderId")).toBeUndefined();
	});

	it("does not set activeProviderId when fileRemoved is true", async () => {
		const { store } = await migrateFromV2({
			modelValues: {
				ai_chat_model_downloadedAt: "2024-06-01T00:00:00Z",
				ai_chat_model_filename: "model.gguf",
				ai_chat_model_fileRemoved: true,
			},
		});

		expect(store.getValue("activeProviderId")).toBeUndefined();
	});

	it("does not set activeProviderId when no model data exists", async () => {
		const { store } = await migrateFromV2({
			modelValues: {},
		});

		expect(store.getValue("activeProviderId")).toBeUndefined();
	});

	// ── T1.7: messages get providerId, modelId, status ───────────────────

	it("adds providerId, modelId, and status to all existing messages", async () => {
		const { store } = await migrateFromV2({
			modelValues: {
				ai_chat_model_downloadedAt: "2024-06-01T00:00:00Z",
				ai_chat_model_filename: "model.gguf",
			},
			tables: {
				messages: {
					"msg-1": {
						id: "msg-1",
						chatId: "chat-1",
						contents: "Hello there",
						role: "user",
						createdAt: "2024-05-01T00:00:00Z",
					},
					"msg-2": {
						id: "msg-2",
						chatId: "chat-1",
						contents: "Hi! How can I help?",
						role: "assistant",
						createdAt: "2024-05-01T00:00:01Z",
					},
					"msg-3": {
						id: "msg-3",
						chatId: "chat-2",
						contents: "Another chat message",
						role: "user",
						createdAt: "2024-05-02T00:00:00Z",
					},
				},
			},
		});

		for (const msgId of ["msg-1", "msg-2", "msg-3"]) {
			const msg = store.getRow("messages", msgId);
			expect(msg.providerId).toBe("whisper-ai");
			expect(msg.modelId).toBe("v0 model");
			expect(msg.status).toBe("done");
		}
	});

	it("preserves original message fields after adding provider fields", async () => {
		const { store } = await migrateFromV2({
			modelValues: {},
			tables: {
				messages: {
					"msg-1": {
						id: "msg-1",
						chatId: "chat-1",
						contents: "Original content",
						role: "user",
						createdAt: "2024-05-01T00:00:00Z",
					},
				},
			},
		});

		const msg = store.getRow("messages", "msg-1");
		expect(msg.id).toBe("msg-1");
		expect(msg.chatId).toBe("chat-1");
		expect(msg.contents).toBe("Original content");
		expect(msg.role).toBe("user");
		expect(msg.createdAt).toBe("2024-05-01T00:00:00Z");
	});

	// ── T1.8: ai_chat_model_* values are removed from output ─────────────

	it("removes ai_chat_model_* values from the store after migration", async () => {
		const { store } = await migrateFromV2({
			modelValues: {
				ai_chat_model_card: '{"sizeGB":0.4}',
				ai_chat_model_cardId: "card-123",
				ai_chat_model_config_version: "1.0",
				ai_chat_model_downloadedAt: "2024-06-01T00:00:00Z",
				ai_chat_model_filename: "model.gguf",
				ai_chat_model_fileUri: "file:///path/to/model.gguf",
				ai_chat_model_progressSizeGB: 0.4,
				ai_chat_model_downloadError: "",
				ai_chat_model_resumableState: "",
				ai_chat_model_isPaused: false,
				ai_chat_model_fileRemoved: false,
			},
			otherValues: {
				onboardedAt: "2024-01-01T00:00:00Z",
			},
		});

		const aiModelKeys = [
			"ai_chat_model_card",
			"ai_chat_model_cardId",
			"ai_chat_model_config_version",
			"ai_chat_model_downloadedAt",
			"ai_chat_model_filename",
			"ai_chat_model_fileUri",
			"ai_chat_model_progressSizeGB",
			"ai_chat_model_downloadError",
			"ai_chat_model_resumableState",
			"ai_chat_model_isPaused",
			"ai_chat_model_fileRemoved",
		];

		for (const key of aiModelKeys) {
			expect(store.getValue(key)).toBeUndefined();
		}

		// Non-model values should still be present
		expect(store.getValue("onboardedAt")).toBe("2024-01-01T00:00:00Z");
		expect(store.getValue("version")).toBe(String(CURRENT_SCHEMA_VERSION));
	});

	// ── T1.9: totalSizeGB is parsed from modelCard JSON ──────────────────

	it("parses totalSizeGB from modelCard JSON sizeGB field", async () => {
		const { store } = await migrateFromV2({
			modelValues: {
				ai_chat_model_card: JSON.stringify({ sizeGB: 1.23 }),
				ai_chat_model_downloadedAt: "2024-06-01T00:00:00Z",
				ai_chat_model_filename: "model.gguf",
			},
		});

		const provider = store.getRow("aiProviders", "whisper-ai");
		expect(provider.totalSizeGB).toBe(1.23);
	});

	it("defaults totalSizeGB to 0 when modelCard has no sizeGB", async () => {
		const { store } = await migrateFromV2({
			modelValues: {
				ai_chat_model_card: JSON.stringify({ name: "some model" }),
				ai_chat_model_downloadedAt: "2024-06-01T00:00:00Z",
				ai_chat_model_filename: "model.gguf",
			},
		});

		const provider = store.getRow("aiProviders", "whisper-ai");
		expect(provider.totalSizeGB).toBe(0);
	});

	it("defaults totalSizeGB to 0 when modelCard is invalid JSON", async () => {
		const { store } = await migrateFromV2({
			modelValues: {
				ai_chat_model_card: "not valid json {{{",
				ai_chat_model_downloadedAt: "2024-06-01T00:00:00Z",
				ai_chat_model_filename: "model.gguf",
			},
		});

		const provider = store.getRow("aiProviders", "whisper-ai");
		expect(provider.totalSizeGB).toBe(0);
	});

	it("defaults totalSizeGB to 0 when no modelCard exists", async () => {
		const { store } = await migrateFromV2({
			modelValues: {
				ai_chat_model_downloadedAt: "2024-06-01T00:00:00Z",
				ai_chat_model_filename: "model.gguf",
			},
		});

		const provider = store.getRow("aiProviders", "whisper-ai");
		expect(provider.totalSizeGB).toBe(0);
	});
});

// ─── Rollback tests ──────────────────────────────────────────────────────────

describe("V3 migration rollback", () => {
	it("restores store to pre-migration state when migration fails", async () => {
		// Create a version-2 store with a message whose `id` is a number.
		// TinyBase allows mixed value types (string | number | boolean).
		// The V3 up() spreads `...msg`, keeping the numeric id.
		// The V3 Zod schema requires `id: z.string()`, so validation fails
		// and runMigrations rolls back to the snapshot.
		const store = createTestStore({
			values: {
				version: "2",
				onboardedAt: "2024-01-01T00:00:00Z",
				ai_chat_model_filename: "model.gguf",
			},
			tables: {
				chats: {
					"chat-1": {
						id: "chat-1",
						name: "My Chat",
						createdAt: "2024-01-01T00:00:00Z",
						folderId: "",
					},
				},
				messages: {
					"msg-1": {
						id: 999, // numeric id causes V3 schema validation to fail
						chatId: "chat-1",
						contents: "Hello",
						role: "user",
						createdAt: "2024-01-01T00:00:00Z",
					},
				},
			},
		});

		const snapshotBefore = getStoreSnapshot(store);
		const result = await runMigrations(store);

		// Migration should have failed
		expect(result.success).toBe(false);

		// Store should be restored to exact pre-migration state
		const snapshotAfter = getStoreSnapshot(store);
		expect(snapshotAfter.values).toEqual(snapshotBefore.values);
		expect(snapshotAfter.tables).toEqual(snapshotBefore.tables);

		// Specific checks: original data is intact
		expect(store.getValue("version")).toBe("2");
		expect(store.getValue("onboardedAt")).toBe("2024-01-01T00:00:00Z");
		expect(store.getValue("ai_chat_model_filename")).toBe("model.gguf");

		const chat = store.getRow("chats", "chat-1");
		expect(chat.name).toBe("My Chat");

		const msg = store.getRow("messages", "msg-1");
		expect(msg.id).toBe(999);
		expect(msg.contents).toBe("Hello");
	});

	it("returns success false with error in MigrationResult when migration fails", async () => {
		const store = createTestStore({
			values: {
				version: "2",
				ai_chat_model_filename: "model.gguf",
			},
			tables: {
				messages: {
					"msg-1": {
						id: 42, // numeric id causes V3 schema validation to fail
						chatId: "chat-1",
						contents: "Test",
						role: "user",
						createdAt: "2024-01-01T00:00:00Z",
					},
				},
			},
		});

		const result = await runMigrations(store);

		expect(result.success).toBe(false);
		expect(result.error).toBeInstanceOf(Error);
		expect(result.migrationsRun).toBe(0);
		expect(result.fromVersion).toBe(2);
		expect(result.toVersion).toBe(2); // stays at original version on failure
	});
});

// ─── V4 migration isolated tests ─────────────────────────────────────────────

describe("V4 migration", () => {
	/**
	 * Build a minimal v3 state that the v4 migration will receive.
	 */
	function createV3State(
		aiProviders: Record<string, Record<string, unknown>> = {},
	) {
		return {
			_version: 3,
			values: {
				version: "3",
				name: "Test",
				onboardedAt: "2026-01-01T00:00:00.000Z",
			},
			tables: {
				chats: {},
				messages: {},
				folders: {},
				aiProviders,
			},
		};
	}

	function fullProviderRow(overrides: Record<string, unknown> = {}) {
		return {
			id: "test",
			status: "ready",
			error: "",
			selectedModelId: "",
			modelCard: "",
			modelCardId: "",
			configVersion: "",
			downloadedAt: "",
			filename: "",
			progressSizeGB: 0,
			totalSizeGB: 0,
			downloadError: "",
			resumableState: "",
			isPaused: false,
			fileRemoved: false,
			apiKey: "",
			oAuthCodeVerifier: "",
			endpointUrl: "",
			protocol: "",
			...overrides,
		};
	}

	it("generates an encryption key", async () => {
		const state = createV3State();
		await migrateAsync({ state, migrations });

		const key = await SecureStore.getItemAsync("whisper_encryption_key");
		expect(key).toBeTruthy();
		expect(key).toHaveLength(64);
	});

	it("migrates API key from state to secure store", async () => {
		const state = createV3State({
			openrouter: fullProviderRow({
				id: "openrouter",
				apiKey: "sk-or-test-key",
			}),
		});

		await migrateAsync({ state, migrations });

		const credential = await getCredential("openrouter", "apiKey");
		expect(credential).toBe("sk-or-test-key");
	});

	it("migrates oAuthCodeVerifier from state to secure store", async () => {
		const state = createV3State({
			openrouter: fullProviderRow({
				id: "openrouter",
				status: "configuring",
				oAuthCodeVerifier: "verifier-123",
			}),
		});

		await migrateAsync({ state, migrations });

		const credential = await getCredential(
			"openrouter",
			"oAuthCodeVerifier",
		);
		expect(credential).toBe("verifier-123");
	});

	it("strips credential fields from migrated state", async () => {
		const state = createV3State({
			openrouter: fullProviderRow({
				id: "openrouter",
				apiKey: "sk-or-test-key",
				oAuthCodeVerifier: "verifier-123",
			}),
		});

		const result = await migrateAsync({ state, migrations });
		const provider = (result as any).tables.aiProviders.openrouter;
		expect(provider.apiKey).toBeUndefined();
		expect(provider.oAuthCodeVerifier).toBeUndefined();
	});

	it("sets encryptionMigratedAt to ISO timestamp", async () => {
		const state = createV3State();
		const result = await migrateAsync({ state, migrations });

		const migratedAt = (result as any).values.encryptionMigratedAt;
		expect(migratedAt).toBeTruthy();
		expect(new Date(migratedAt).toISOString()).toBe(migratedAt);
	});

	it("does not run v4 up() if state is already at v4", async () => {
		// State already at v4 — no migrations should run, no key generated
		const state = {
			_version: 4,
			values: {
				version: "4",
				encryptionMigratedAt: "2026-01-01T00:00:00.000Z",
			},
			tables: {
				chats: {},
				messages: {},
				folders: {},
				aiProviders: {},
			},
		};

		await migrateAsync({ state, migrations });

		const key = await SecureStore.getItemAsync("whisper_encryption_key");
		expect(key).toBeNull();
	});

	it("handles state with no aiProviders", async () => {
		const state = createV3State();
		const result = await migrateAsync({ state, migrations });

		const migratedAt = (result as any).values.encryptionMigratedAt;
		expect(migratedAt).toBeTruthy();
	});

	it("migrates custom-provider credentials", async () => {
		const state = createV3State({
			"custom-provider": fullProviderRow({
				id: "custom-provider",
				apiKey: "sk-custom-key",
				endpointUrl: "https://api.example.com/v1",
				protocol: "openai",
			}),
		});

		await migrateAsync({ state, migrations });

		const credential = await getCredential("custom-provider", "apiKey");
		expect(credential).toBe("sk-custom-key");

		// Verify stripped from state
		const result = await migrateAsync({
			state: createV3State({
				"custom-provider": fullProviderRow({
					id: "custom-provider",
					apiKey: "sk-custom-key-2",
				}),
			}),
			migrations,
		});
		expect(
			(result as any).tables.aiProviders["custom-provider"].apiKey,
		).toBeUndefined();
	});
});
