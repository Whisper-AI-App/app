import { MigrationErrorScreen } from "@/components/migration-error-screen";
import { resetEverything } from "@/src/actions/reset";
import type { ExpoFileSystemPersister } from "@/src/stores/main/encrypted-persister";
import { createExpoFileSystemPersister } from "@/src/stores/main/encrypted-persister";
import { loadEncryptionKey } from "@/src/stores/main/encryption-key";
import {
	initMainStore,
	mainStore,
	mainStoreFilePath,
} from "@/src/stores/main/main-store";
import { runMigrations } from "@/src/stores/main/migrations";
import type { ReactNode } from "react";
import { useRef, useState } from "react";
import type { Store } from "tinybase";
import { useCreatePersister } from "tinybase/ui-react";

export function StoreProvider({ children }: { children: ReactNode }) {
	const [migrationError, setMigrationError] = useState<Error | null>(null);
	const debounceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);

	useCreatePersister(
		mainStore as unknown as Store,
		(_store) => {
			return createExpoFileSystemPersister(
				_store,
				mainStoreFilePath,
				null,
				(error) => {
					console.error("Persister error:", error);
				},
			);
		},
		[],
		async (persister) => {
			const p = persister as ExpoFileSystemPersister;

			// attempt to load encryption key from SecureStore
			const key = await loadEncryptionKey();
			if (key) {
				p.setEncryptionKey(key);
			}

			// Load store data (encrypted or plain, with fallback)
			await p.load();

			// Run migrations
			const result = await runMigrations(mainStore as unknown as Store);

			console.info("[State] Finished migrations. status:", result);

			if (!result.success) {
				setMigrationError(
					result.error || new Error("Migration failed unexpectedly"),
				);
				return;
			}

			// If migration just generated a key, enable encryption for save
			if (!key) {
				const newKey = await loadEncryptionKey();
				if (newKey) {
					p.setEncryptionKey(newKey);
				}
			}

			// Save (encrypts if key is now set)
			await p.save();

			// Set up debounced auto-save (500ms) instead of immediate auto-save
			const store = mainStore as unknown as Store;
			store.addDidFinishTransactionListener(() => {
				if (debounceSaveTimerRef.current) {
					clearTimeout(debounceSaveTimerRef.current);
				}
				debounceSaveTimerRef.current = setTimeout(() => {
					p.save();
				}, 500);
			});

			// Note: startAutoLoad() is intentionally NOT used here.
			// It polls the file for external changes, but since this mobile app
			// is the sole writer, it only detects our own saves and reloads them —
			// overwriting any in-memory changes that occurred since the last save.
			initMainStore();
		},
	);

	if (migrationError) {
		return (
			<MigrationErrorScreen error={migrationError} onReset={resetEverything} />
		);
	}

	return <>{children}</>;
}
