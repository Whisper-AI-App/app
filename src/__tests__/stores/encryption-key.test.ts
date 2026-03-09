import {
	generateEncryptionKey,
	loadEncryptionKey,
	ENCRYPTION_KEY_STORE_ID,
} from "@/src/stores/main/encryption-key";
import * as SecureStore from "expo-secure-store";

// Use the manual mock from __mocks__/expo-secure-store.ts
jest.mock("expo-secure-store");
jest.mock("expo-crypto");

// Access the reset helper from the mock
const { __resetStore } = SecureStore as typeof SecureStore & {
	__resetStore: () => void;
};

beforeEach(() => {
	__resetStore();
	jest.clearAllMocks();
});

describe("generateEncryptionKey", () => {
	it("generates a 64-character hex key", async () => {
		const keyHex = await generateEncryptionKey();
		expect(keyHex).toHaveLength(64);
		expect(keyHex).toMatch(/^[0-9a-f]+$/);
	});

	it("stores the key in expo-secure-store", async () => {
		const keyHex = await generateEncryptionKey();
		const stored = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE_ID);
		expect(stored).toBe(keyHex);
	});
});

describe("loadEncryptionKey", () => {
	it("returns the key when it exists in secure store", async () => {
		const expectedKey = "b".repeat(64);
		await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE_ID, expectedKey);

		const keyHex = await loadEncryptionKey();
		expect(keyHex).toBe(expectedKey);
	});

	it("returns null when no key exists", async () => {
		const keyHex = await loadEncryptionKey();
		expect(keyHex).toBeNull();
	});

	it("returns null for corrupted key (not 64 hex chars)", async () => {
		await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE_ID, "short");
		const keyHex = await loadEncryptionKey();
		expect(keyHex).toBeNull();
	});

	it("returns null for key with non-hex characters", async () => {
		await SecureStore.setItemAsync(
			ENCRYPTION_KEY_STORE_ID,
			"g".repeat(64),
		);
		const keyHex = await loadEncryptionKey();
		expect(keyHex).toBeNull();
	});
});
