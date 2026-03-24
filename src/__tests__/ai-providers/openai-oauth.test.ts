import {
	requestDeviceCode,
	pollForAuthorization,
	cancelPolling,
} from "@/src/ai-providers/openai/oauth";
import * as SecureStore from "expo-secure-store";
import { getCredential } from "@/src/actions/secure-credentials";
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
				device_auth_id: "auth-123",
				user_code: "ABCD-1234",
				interval: "5",
			}),
		});

		const result = await requestDeviceCode(store);

		expect(result).toEqual({
			userCode: "ABCD-1234",
			deviceAuthId: "auth-123",
			verificationUrl: "https://auth.openai.com/codex/device",
		});
		expect(store.getCell("aiProviders", "openai", "status")).toBe(
			"configuring",
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
		expect(store.getCell("aiProviders", "openai", "status")).toBe("error");
		expect(store.getCell("aiProviders", "openai", "error")).toContain(
			"500",
		);
	});

	it("sets error status on network failure", async () => {
		const store = createStore();

		(global.fetch as jest.Mock).mockRejectedValueOnce(
			new Error("Network error"),
		);

		const result = await requestDeviceCode(store);

		expect(result).toBeNull();
		expect(store.getCell("aiProviders", "openai", "status")).toBe("error");
	});
});

describe("pollForAuthorization", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("stores tokens when authorization succeeds on first poll", async () => {
		const store = createStore();

		// Poll returns success immediately, then token exchange succeeds
		(global.fetch as jest.Mock)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					authorization_code: "code-123",
					code_verifier: "verifier-abc",
				}),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					access_token: "access-tok",
					refresh_token: "refresh-tok",
					expires_in: 3600,
					id_token:
						"header." +
						btoa(
							JSON.stringify({
								chatgpt_account_id: "acct-xyz",
							}),
						) +
						".sig",
				}),
			});

		const pollPromise = pollForAuthorization(store, "auth-123", "ABCD-1234");

		// Advance past the poll interval
		await jest.advanceTimersByTimeAsync(6000);

		await pollPromise;

		expect(store.getCell("aiProviders", "openai", "status")).toBe("ready");

		const accessToken = await getCredential("openai", "accessToken");
		expect(accessToken).toBe("access-tok");

		const refreshToken = await getCredential("openai", "refreshToken");
		expect(refreshToken).toBe("refresh-tok");

		const accountId = await getCredential("openai", "accountId");
		expect(accountId).toBe("acct-xyz");
	});

	it("can be cancelled", async () => {
		const store = createStore();

		(global.fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status: 403,
		});

		const pollPromise = pollForAuthorization(
			store,
			"auth-123",
			"ABCD-1234",
		);

		// Cancel before the first poll fires
		cancelPolling();

		// Advance timers so the cancelled promise resolves
		await jest.advanceTimersByTimeAsync(6000);

		// Should resolve without throwing
		await expect(pollPromise).resolves.toBeUndefined();

		// Should not have set ready
		expect(
			store.getCell("aiProviders", "openai", "status"),
		).not.toBe("ready");
	});
});
