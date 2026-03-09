const store = new Map<string, string>();

export async function setItemAsync(key: string, value: string): Promise<void> {
	store.set(key, value);
}

export async function getItemAsync(key: string): Promise<string | null> {
	return store.get(key) ?? null;
}

export async function deleteItemAsync(key: string): Promise<void> {
	store.delete(key);
}

/**
 * Clears all items in the mock store.
 * Useful for test cleanup.
 */
export function __resetStore(): void {
	store.clear();
}
