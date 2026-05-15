import {
	setCredential,
	getCredential,
	deleteCredential,
	deleteProviderCredentials,
	getProviderCredentials,
} from "@/src/actions/secure-credentials";
import * as SecureStore from "expo-secure-store";

jest.mock("expo-secure-store");

const { __resetStore } = SecureStore as typeof SecureStore & {
	__resetStore: () => void;
};

beforeEach(() => {
	__resetStore();
	jest.clearAllMocks();
});

describe("setCredential / getCredential", () => {
	it("stores and retrieves a credential", async () => {
		await setCredential("custom-provider", "apiKey", "sk-test-123");
		const value = await getCredential("custom-provider", "apiKey");
		expect(value).toBe("sk-test-123");
	});

	it("returns null for non-existent credential", async () => {
		const value = await getCredential("custom-provider", "apiKey");
		expect(value).toBeNull();
	});

	it("uses correct key naming convention (credential_{providerId}_{field})", async () => {
		await setCredential("custom-provider", "apiKey", "sk-test");
		// Verify the key naming by directly checking the secure store
		const value = await SecureStore.getItemAsync("credential_custom-provider_apiKey");
		expect(value).toBe("sk-test");
	});

	it("handles huggingface provider", async () => {
		await setCredential("huggingface", "apiToken", "hf-token");
		const value = await getCredential("huggingface", "apiToken");
		expect(value).toBe("hf-token");
	});
});

describe("deleteCredential", () => {
	it("deletes a stored credential", async () => {
		await setCredential("custom-provider", "apiKey", "sk-test");
		await deleteCredential("custom-provider", "apiKey");
		const value = await getCredential("custom-provider", "apiKey");
		expect(value).toBeNull();
	});

	it("does not throw when deleting non-existent credential", async () => {
		await expect(
			deleteCredential("custom-provider", "apiKey"),
		).resolves.not.toThrow();
	});
});

describe("deleteProviderCredentials", () => {
	it("deletes all known credentials for a provider", async () => {
		await setCredential("custom-provider", "apiKey", "sk-test");
		await deleteProviderCredentials("custom-provider");

		const apiKey = await getCredential("custom-provider", "apiKey");
		expect(apiKey).toBeNull();
	});
});

describe("getProviderCredentials", () => {
	it("returns all credentials for custom-provider", async () => {
		await setCredential("custom-provider", "apiKey", "sk-test");

		const creds = await getProviderCredentials("custom-provider");
		expect(creds).toEqual({
			apiKey: "sk-test",
		});
	});

	it("returns only non-null credentials", async () => {
		// apiKey set but nothing else for huggingface
		await setCredential("huggingface", "apiToken", "hf-token");

		const creds = await getProviderCredentials("huggingface");
		expect(creds).toEqual({
			apiToken: "hf-token",
		});
	});

	it("returns empty object for provider with no credentials", async () => {
		const creds = await getProviderCredentials("custom-provider");
		expect(creds).toEqual({});
	});

	it("returns credentials for huggingface", async () => {
		await setCredential("huggingface", "apiToken", "hf-token-123");

		const creds = await getProviderCredentials("huggingface");
		expect(creds).toEqual({
			apiToken: "hf-token-123",
		});
	});
});
