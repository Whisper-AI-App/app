import { migrate } from "@nanocollective/json-up";
import * as FileSystem from "expo-file-system/legacy";
import type { Row, Store, Value } from "tinybase";
import { mainStoreFilePath } from "../main-store";
import {
	CURRENT_SCHEMA_VERSION,
	migrations,
	type StoreState,
} from "./migrations";

export interface MigrationResult {
	success: boolean;
	fromVersion: number;
	toVersion: number;
	migrationsRun: number;
	error?: Error;
}

/**
 * Gets the effective version for migration purposes.
 * Existing users may have version "1" or undefined - both are treated as 0
 * to ensure the baseline migration runs.
 */
function getEffectiveVersion(store: Store): number {
	const version = store.getValue("version") as string | undefined;
	// Treat missing or "1" (legacy) as 0 to ensure baseline migration runs
	if (!version || version === "1") {
		return 0;
	}
	return Number(version);
}

/**
 * Convert TinyBase Store to plain JSON for json-up.
 */
function storeToJson(store: Store): StoreState {
	return {
		_version: getEffectiveVersion(store),
		values: store.getValues() as Record<string, unknown>,
		tables: store.getTables() as StoreState["tables"],
	};
}

/**
 * Apply migrated JSON back to TinyBase Store.
 */
function jsonToStore(store: Store, state: StoreState): void {
	// Wrap in transaction so auto-save listeners don't fire during the
	// intermediate empty-store window between delValues/delTables and re-adds.
	store.transaction(() => {
		store.delValues();
		store.delTables();

		for (const [key, value] of Object.entries(state.values)) {
			store.setValue(key, value as Value);
		}
		// Set version from migrated state
		store.setValue("version", String(state._version));

		// Restore tables
		for (const [tableId, rows] of Object.entries(state.tables)) {
			for (const [rowId, row] of Object.entries(rows)) {
				store.setRow(tableId, rowId, row as Row);
			}
		}
	});
}

/**
 * Creates a backup file before running migrations.
 */
async function createBackup(
	store: Store,
	currentVersion: number,
): Promise<void> {
	const backupPath = mainStoreFilePath.replace(".json", ".backup.json");
	const backupData = {
		values: store.getValues(),
		tables: store.getTables(),
		backupVersion: currentVersion,
		backupTimestamp: new Date().toISOString(),
	};
	await FileSystem.writeAsStringAsync(backupPath, JSON.stringify(backupData));
}

/**
 * Creates a snapshot of the current store state for rollback.
 */
function createSnapshot(store: Store): {
	values: Record<string, unknown>;
	tables: StoreState["tables"];
} {
	return {
		values: store.getValues() as Record<string, unknown>,
		tables: store.getTables() as StoreState["tables"],
	};
}

/**
 * Restores the store from a snapshot.
 */
function restoreFromSnapshot(
	store: Store,
	snapshot: { values: Record<string, unknown>; tables: StoreState["tables"] },
): void {
	store.delValues();
	store.delTables();

	for (const [key, value] of Object.entries(snapshot.values)) {
		store.setValue(key, value as Value);
	}

	for (const [tableId, rows] of Object.entries(snapshot.tables)) {
		for (const [rowId, row] of Object.entries(rows)) {
			store.setRow(tableId, rowId, row as Row);
		}
	}
}

/**
 * Runs all pending migrations on the store.
 *
 * This function:
 * 1. Determines the current schema version (treating missing/legacy as 0)
 * 2. Creates a backup before any migrations run
 * 3. Takes an in-memory snapshot for rollback
 * 4. Runs migrations via json-up
 * 5. Applies the migrated state back to the store
 * 6. Rolls back on failure and returns an error
 *
 * @param store The TinyBase store to migrate
 * @returns MigrationResult indicating success/failure and versions
 */
export async function runMigrations(store: Store): Promise<MigrationResult> {
	const state = storeToJson(store);
	const fromVersion = state._version;

	// Create backup before any migrations
	try {
		await createBackup(store, fromVersion);
	} catch (error) {
		console.warn("Failed to create backup:", error);
		// Continue anyway - backup failure shouldn't block migrations
	}

	// Take in-memory snapshot for rollback
	const snapshot = createSnapshot(store);

	// Run migrations via json-up
	try {
		const migrationsRun =
			fromVersion < CURRENT_SCHEMA_VERSION
				? CURRENT_SCHEMA_VERSION - fromVersion
				: 0;

		if (migrationsRun > 0) {
			const result = migrate({ state, migrations });
			jsonToStore(store, result);
		}

		return {
			success: true,
			fromVersion,
			toVersion: CURRENT_SCHEMA_VERSION,
			migrationsRun,
		};
	} catch (error) {
		// Rollback to snapshot
		if (__DEV__) {
			console.error("Migration failed, rolling back:", error);
		}
		restoreFromSnapshot(store, snapshot);

		const err = error instanceof Error ? error : new Error(String(error));
		return {
			success: false,
			fromVersion,
			toVersion: fromVersion,
			migrationsRun: 0,
			error: err,
		};
	}
}
