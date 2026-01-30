/**
 * Tests to ensure the mock store schema stays in sync with the real main store schema.
 *
 * These tests will fail if:
 * 1. A new table is added to the real schema but not recognized in the mock
 * 2. A new cell is added to a table schema
 */

import {
	getMockMainStoreData,
	resetMockMainStore,
} from "../../__mocks__/main-store-mock";
import { tablesSchemaMainStore } from "../../stores/main/schema";

describe("store schema sync validation", () => {
	beforeEach(() => {
		resetMockMainStore();
	});

	describe("table schema synchronization", () => {
		it("mock store should have all tables defined in tablesSchema", () => {
			const realTableNames = Object.keys(tablesSchemaMainStore).sort();
			const mockTableNames = Object.keys(getMockMainStoreData().tables).sort();

			expect(mockTableNames).toEqual(realTableNames);
		});

		it("mock store should not have extra tables not in tablesSchema", () => {
			const realTableNames = new Set(Object.keys(tablesSchemaMainStore));
			const mockTableNames = Object.keys(getMockMainStoreData().tables);

			const extraTables = mockTableNames.filter(
				(name) => !realTableNames.has(name),
			);

			expect(extraTables).toEqual([]);
		});
	});

	describe("cell schema completeness", () => {
		it("chats table should have id, name, createdAt, folderId cells", () => {
			const chatCells = Object.keys(tablesSchemaMainStore.chats);

			expect(chatCells).toContain("id");
			expect(chatCells).toContain("name");
			expect(chatCells).toContain("createdAt");
			expect(chatCells).toContain("folderId");
			expect(chatCells).toHaveLength(4);
		});

		it("messages table should have id, chatId, contents, role, createdAt cells", () => {
			const messageCells = Object.keys(tablesSchemaMainStore.messages);

			expect(messageCells).toContain("id");
			expect(messageCells).toContain("chatId");
			expect(messageCells).toContain("contents");
			expect(messageCells).toContain("role");
			expect(messageCells).toContain("createdAt");
			expect(messageCells).toHaveLength(5);
		});

		it("each table cell should have a type definition", () => {
			Object.entries(tablesSchemaMainStore).forEach(
				([_tableName, cellSchema]) => {
					Object.entries(cellSchema).forEach(([_cellName, cellDef]) => {
						expect(cellDef).toHaveProperty("type");
						expect(["string", "boolean", "number"]).toContain(cellDef.type);
					});
				},
			);
		});
	});
});
