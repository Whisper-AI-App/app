import { createStore } from "tinybase";
import type { Store, Value, Row } from "tinybase";

interface TestStoreData {
	values?: Record<string, unknown>;
	tables?: Record<string, Record<string, Record<string, unknown>>>;
}

/**
 * Creates a TinyBase store for testing migrations.
 * Uses a real TinyBase store (not mocked) for accurate migration testing.
 */
export function createTestStore(data?: TestStoreData): Store {
	const store = createStore();

	if (data?.values) {
		for (const [key, value] of Object.entries(data.values)) {
			store.setValue(key, value as Value);
		}
	}

	if (data?.tables) {
		for (const [tableId, rows] of Object.entries(data.tables)) {
			for (const [rowId, row] of Object.entries(rows)) {
				store.setRow(tableId, rowId, row as Row);
			}
		}
	}

	return store;
}

/**
 * Gets all store data as a plain object for assertions.
 */
export function getStoreSnapshot(store: Store): TestStoreData {
	return {
		values: store.getValues(),
		tables: store.getTables(),
	};
}
