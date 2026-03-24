import {
	requestDeviceCode,
	pollForAuthorization,
	cancelPolling,
	getCopilotApiToken,
	clearCopilotTokenCache,
} from "@/src/ai-providers/github-copilot/oauth";
import * as SecureStore from "expo-secure-store";
import { getCredential, setCredential } from "@/src/actions/secure-credentials";
import { createStore } from "tinybase";

jest.mock("expo-secure-store");
jest.mock("expo-linking", () => ({
	openURL: jest.fn(),
}));

const { __resetStore } = SecureStore as typeof SecureStore & {
	__resetStore: () => void;
};

beforeEach(() => {
	__resetStore();
	clearCopilotTokenCache();
	jest.clearAllMocks();
	(global.fetch as jest.Mock) = jest.fn();
});

afterEach(() => {
	cancelPolling();
	jest.restoreAllMocks();
});

describe("requestDeviceCode", () => {
	it("returns device code state on success", async () => {
		const store = createStore();

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				device_code: "dev-123",
				user_code: "ABCD-1234",
				verification_uri: "https://github.com/login/device",
				interval: 5,
			}),
		});

		const result = await requestDeviceCode(store);

		expect(result).toEqual({
			userCode: "ABCD-1234",
			deviceCode: "dev-123",
			verificationUrl: "https://github.com/login/device",
			interval: 5,
		});
		expect(store.getCell("aiProviders", "github-copilot", "status")).toBe(
			"configuring",
		);
	});

	it("sends correct client_id and scope", async () => {
		const store = createStore();

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				device_code: "dev-123",
				user_code: "XXXX",
				verification_uri: "https://github.com/login/device",
				interval: 5,
			}),
		});

		await requestDeviceCode(store);

		expect(global.fetch).toHaveBeenCalledWith(
			"https://github.com/login/device/code",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({
					client_id: "Iv1.b507a08c87ecfe98",
					scope: "read:user",
				}),
			}),
		);
	});

	it("sets error status when request fails", async () => {
		const store = createStore();

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 500,
		});

		const result = await requestDeviceCode(store);

		expect(result).toBeNull();
		expect(store.getCell("aiProviders", "github-copilot", "status")).toBe(
			"error",
		);
	});
});

describe("pollForAuthorization", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("stores OAuth token when authorization succeeds", async () => {
		const store = createStore();

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ access_token: "gho_abc123" }),
		});

		const pollPromise = pollForAuthorization(store, "dev-123", 5);
		await jest.advanceTimersByTimeAsync(6000);
		await pollPromise;

		expect(store.getCell("aiProviders", "github-copilot", "status")).toBe(
			"ready",
		);
		const token = await getCredential("github-copilot", "oauthToken");
		expect(token).toBe("gho_abc123");
	});

	it("continues polling on authorization_pending", async () => {
		const store = createStore();

		(global.fetch as jest.Mock)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ error: "authorization_pending" }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: "gho_after_pending" }),
			});

		const pollPromise = pollForAuthorization(store, "dev-123", 5);
		await jest.advanceTimersByTimeAsync(6000);
		await jest.advanceTimersByTimeAsync(6000);
		await pollPromise;

		expect(store.getCell("aiProviders", "github-copilot", "status")).toBe(
			"ready",
		);
		const token = await getCredential("github-copilot", "oauthToken");
		expect(token).toBe("gho_after_pending");
	});

	it("sets error on expired_token", async () => {
		const store = createStore();

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: async () => ({ error: "expired_token" }),
		});

		const pollPromise = pollForAuthorization(store, "dev-123", 5);
		await jest.advanceTimersByTimeAsync(6000);
		await pollPromise;

		expect(store.getCell("aiProviders", "github-copilot", "status")).toBe(
			"error",
		);
		expect(
			store.getCell("aiProviders", "github-copilot", "error"),
		).toContain("expired");
	});

	it("can be cancelled", async () => {
		const store = createStore();

		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			json: async () => ({ error: "authorization_pending" }),
		});

		const pollPromise = pollForAuthorization(store, "dev-123", 5);
		cancelPolling();
		await jest.advanceTimersByTimeAsync(6000);
		await expect(pollPromise).resolves.toBeUndefined();

		expect(
			store.getCell("aiProviders", "github-copilot", "status"),
		).not.toBe("ready");
	});
});

describe("getCopilotApiToken", () => {
	it("returns null when no OAuth token stored", async () => {
		const token = await getCopilotApiToken();
		expect(token).toBeNull();
	});

	it("exchanges OAuth token for Copilot API token", async () => {
		await setCredential("github-copilot", "oauthToken", "gho_test");

		const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				token: "copilot-api-tok",
				expires_at: futureExpiry,
			}),
		});

		const token = await getCopilotApiToken();
		expect(token).toBe("copilot-api-tok");

		// Verify it called the right endpoint with Bearer token
		expect(global.fetch).toHaveBeenCalledWith(
			"https://api.github.com/copilot_internal/v2/token",
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: "Bearer gho_test",
				}),
			}),
		);
	});

	it("returns cached token on second call", async () => {
		await setCredential("github-copilot", "oauthToken", "gho_test");

		const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				token: "copilot-cached",
				expires_at: futureExpiry,
			}),
		});

		const token1 = await getCopilotApiToken();
		const token2 = await getCopilotApiToken();

		expect(token1).toBe("copilot-cached");
		expect(token2).toBe("copilot-cached");
		expect(global.fetch).toHaveBeenCalledTimes(1);
	});

	it("returns null when token endpoint fails", async () => {
		await setCredential("github-copilot", "oauthToken", "gho_bad");

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 401,
		});

		const token = await getCopilotApiToken();
		expect(token).toBeNull();
	});

	it("returns null when response has no token", async () => {
		await setCredential("github-copilot", "oauthToken", "gho_nosub");

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: async () => ({}),
		});

		const token = await getCopilotApiToken();
		expect(token).toBeNull();
	});

	it("clears cache on clearCopilotTokenCache", async () => {
		await setCredential("github-copilot", "oauthToken", "gho_test");

		const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			json: async () => ({
				token: "copilot-fresh",
				expires_at: futureExpiry,
			}),
		});

		await getCopilotApiToken();
		clearCopilotTokenCache();
		await getCopilotApiToken();

		// Should have called fetch twice since cache was cleared
		expect(global.fetch).toHaveBeenCalledTimes(2);
	});
});
