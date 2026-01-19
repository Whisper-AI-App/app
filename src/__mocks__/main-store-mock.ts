// Mock TinyBase store for testing
import { tablesSchemaMainStore } from "../stores/main/schema";

// Helper to create empty tables structure from schema
const createEmptyTables = (): Record<
	string,
	Record<string, Record<string, unknown>>
> =>
	Object.keys(tablesSchemaMainStore).reduce(
		(acc, tableName) => {
			acc[tableName] = {};
			return acc;
		},
		{} as Record<string, Record<string, Record<string, unknown>>>,
	);

const mockMainStoreData: {
	values: Record<string, unknown>;
	tables: Record<string, Record<string, Record<string, unknown>>>;
} = {
	values: {},
	tables: createEmptyTables(),
};

export const mockMainStore = {
	// Values
	getValue: jest.fn((key: string) => mockMainStoreData.values[key]),
	setValue: jest.fn((key: string, value: unknown) => {
		mockMainStoreData.values[key] = value;
	}),
	delValue: jest.fn((key: string) => {
		delete mockMainStoreData.values[key];
	}),
	delValues: jest.fn(() => {
		mockMainStoreData.values = {};
	}),

	// Tables & Rows
	getRow: jest.fn(
		(tableId: string, rowId: string) =>
			mockMainStoreData.tables[tableId]?.[rowId],
	),
	setRow: jest.fn(
		(tableId: string, rowId: string, row: Record<string, unknown>) => {
			if (!mockMainStoreData.tables[tableId]) {
				mockMainStoreData.tables[tableId] = {};
			}
			mockMainStoreData.tables[tableId][rowId] = row;
		},
	),
	delRow: jest.fn((tableId: string, rowId: string) => {
		if (mockMainStoreData.tables[tableId]) {
			delete mockMainStoreData.tables[tableId][rowId];
		}
	}),
	getRowIds: jest.fn((tableId: string) =>
		Object.keys(mockMainStoreData.tables[tableId] || {}),
	),
	delTable: jest.fn((tableId: string) => {
		if (mockMainStoreData.tables[tableId]) {
			mockMainStoreData.tables[tableId] = {};
		}
	}),
	delTables: jest.fn(() => {
		mockMainStoreData.tables = createEmptyTables();
	}),
};

// Helper to reset store state between tests
export const resetMockMainStore = () => {
	mockMainStoreData.values = {};
	mockMainStoreData.tables = createEmptyTables();
	jest.clearAllMocks();
};

// Helper to seed store with test data
export const seedMockMainStore = (
	values?: Record<string, unknown>,
	tables?: Record<string, Record<string, Record<string, unknown>>>,
) => {
	if (values) {
		mockMainStoreData.values = { ...mockMainStoreData.values, ...values };
	}
	if (tables) {
		Object.keys(tables).forEach((tableId) => {
			if (!mockMainStoreData.tables[tableId]) {
				mockMainStoreData.tables[tableId] = {};
			}
			mockMainStoreData.tables[tableId] = {
				...mockMainStoreData.tables[tableId],
				...tables[tableId],
			};
		});
	}
};

// Helper to get internal mock data (for assertions)
export const getMockMainStoreData = () => mockMainStoreData;
