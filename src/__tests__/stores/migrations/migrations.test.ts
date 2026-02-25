import { createTestStore, getStoreSnapshot } from "./helpers";

// Mock expo-file-system (new API)
jest.mock("expo-file-system", () => ({
	writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
	Directory: jest.fn().mockImplementation(() => ({
		uri: "file:///mock/documents",
	})),
	Paths: { document: "file:///mock/documents" },
}));

// Mock expo-file-system/legacy (used by migrations/index.ts)
jest.mock("expo-file-system/legacy", () => ({
	writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock main-store to avoid import side effects
jest.mock("../../../stores/main/main-store", () => ({
	mainStoreFilePath: "file:///mock/documents/whisper.json",
}));

import { runMigrations } from "../../../stores/main/migrations";
import {
	CURRENT_SCHEMA_VERSION,
	migrations,
} from "../../../stores/main/migrations/migrations";
import {
	tablesSchemaMainStore,
	valuesSchemaMainStore,
} from "../../../stores/main/schema";

describe("migrations", () => {
	describe("runMigrations", () => {
		it("skips when already at current version", async () => {
			const store = createTestStore({
				values: {
					version: String(CURRENT_SCHEMA_VERSION),
					onboardedAt: "2024-01-01T00:00:00Z",
					ai_chat_model_downloadedAt: "2024-01-02T00:00:00Z",
					ai_chat_model_fileUri: "file:///some/model.gguf",
				},
			});

			const result = await runMigrations(store);

			expect(result.success).toBe(true);
			expect(result.migrationsRun).toBe(0);
			expect(result.fromVersion).toBe(CURRENT_SCHEMA_VERSION);
			expect(result.toVersion).toBe(CURRENT_SCHEMA_VERSION);
			expect(store.getValue("onboardedAt")).toBe("2024-01-01T00:00:00Z");
			expect(store.getValue("ai_chat_model_downloadedAt")).toBe(
				"2024-01-02T00:00:00Z",
			);
			expect(store.getValue("ai_chat_model_fileUri")).toBe(
				"file:///some/model.gguf",
			);
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

		it("creates backup before running migrations", async () => {
			const FileSystem = require("expo-file-system/legacy");
			FileSystem.writeAsStringAsync.mockClear();

			const store = createTestStore({
				values: {},
				tables: { chats: {}, messages: {}, folders: {} },
			});

			await runMigrations(store);

			expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
			const [backupPath, backupData] =
				FileSystem.writeAsStringAsync.mock.calls[0];
			expect(backupPath).toContain(".backup.json");

			const parsed = JSON.parse(backupData);
			expect(parsed).toHaveProperty("backupVersion");
			expect(parsed).toHaveProperty("backupTimestamp");
			expect(parsed).toHaveProperty("values");
			expect(parsed).toHaveProperty("tables");
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
			sparseRow: { contents: "Hello" }, // missing id, chatId, role, createdAt
			fullRow: {
				id: "row-1",
				chatId: "c-1",
				contents: "Hi",
				role: "assistant",
				createdAt: "2024-01-15T10:30:00Z",
			},
			requiredFields: ["id", "chatId", "contents", "role", "createdAt"],
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
			const migrationCells = Object.keys(tableRecord.element.shape);
			const storeCells = Object.keys(
				tablesSchemaMainStore[tableName as keyof typeof tablesSchemaMainStore],
			);
			expect(new Set(migrationCells)).toEqual(new Set(storeCells));
		}
	});
});
