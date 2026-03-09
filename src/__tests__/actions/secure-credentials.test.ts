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
		await setCredential("openrouter", "apiKey", "sk-test-123");
		const value = await getCredential("openrouter", "apiKey");
		expect(value).toBe("sk-test-123");
	});

	it("returns null for non-existent credential", async () => {
		const value = await getCredential("openrouter", "apiKey");
		expect(value).toBeNull();
	});

	it("uses correct key naming convention (credential_{providerId}_{field})", async () => {
		await setCredential("openrouter", "apiKey", "sk-test");
		// Verify the key naming by directly checking the secure store
		const value = await SecureStore.getItemAsync("credential_openrouter_apiKey");
		expect(value).toBe("sk-test");
	});

	it("handles custom-provider with hyphen in ID", async () => {
		await setCredential("custom-provider", "apiKey", "sk-custom");
		const value = await getCredential("custom-provider", "apiKey");
		expect(value).toBe("sk-custom");
	});
});

describe("deleteCredential", () => {
	it("deletes a stored credential", async () => {
		await setCredential("openrouter", "apiKey", "sk-test");
		await deleteCredential("openrouter", "apiKey");
		const value = await getCredential("openrouter", "apiKey");
		expect(value).toBeNull();
	});

	it("does not throw when deleting non-existent credential", async () => {
		await expect(
			deleteCredential("openrouter", "apiKey"),
		).resolves.not.toThrow();
	});
});

describe("deleteProviderCredentials", () => {
	it("deletes all known credentials for a provider", async () => {
		await setCredential("openrouter", "apiKey", "sk-test");
		await setCredential("openrouter", "oAuthCodeVerifier", "verifier-123");
		await deleteProviderCredentials("openrouter");

		const apiKey = await getCredential("openrouter", "apiKey");
		const verifier = await getCredential("openrouter", "oAuthCodeVerifier");
		expect(apiKey).toBeNull();
		expect(verifier).toBeNull();
	});
});

describe("getProviderCredentials", () => {
	it("returns all credentials for openrouter", async () => {
		await setCredential("openrouter", "apiKey", "sk-test");
		await setCredential("openrouter", "oAuthCodeVerifier", "verifier-123");

		const creds = await getProviderCredentials("openrouter");
		expect(creds).toEqual({
			apiKey: "sk-test",
			oAuthCodeVerifier: "verifier-123",
		});
	});

	it("returns only non-null credentials", async () => {
		await setCredential("openrouter", "apiKey", "sk-test");
		// oAuthCodeVerifier not set

		const creds = await getProviderCredentials("openrouter");
		expect(creds).toEqual({
			apiKey: "sk-test",
		});
	});

	it("returns empty object for provider with no credentials", async () => {
		const creds = await getProviderCredentials("openrouter");
		expect(creds).toEqual({});
	});

	it("returns credentials for custom-provider", async () => {
		await setCredential("custom-provider", "apiKey", "sk-custom");

		const creds = await getProviderCredentials("custom-provider");
		expect(creds).toEqual({
			apiKey: "sk-custom",
		});
	});
});
