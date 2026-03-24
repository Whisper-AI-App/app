import { getValidAccessToken } from "@/src/ai-providers/token-refresh";
import * as SecureStore from "expo-secure-store";
import {
	setCredential,
	getCredential,
} from "@/src/actions/secure-credentials";

jest.mock("expo-secure-store");

const { __resetStore } = SecureStore as typeof SecureStore & {
	__resetStore: () => void;
};

beforeEach(() => {
	__resetStore();
	jest.clearAllMocks();
	(global.fetch as jest.Mock) = jest.fn();
});

afterEach(() => {
	jest.restoreAllMocks();
});

const CONFIG = {
	providerId: "test-provider",
	tokenUrl: "https://auth.example.com/token",
	clientId: "test-client-id",
};

describe("getValidAccessToken", () => {
	it("returns null when no access token stored", async () => {
		const token = await getValidAccessToken(CONFIG);
		expect(token).toBeNull();
	});

	it("returns access token when no expiry is tracked", async () => {
		await setCredential("test-provider", "accessToken", "tok-123");

		const token = await getValidAccessToken(CONFIG);
		expect(token).toBe("tok-123");
	});

	it("returns access token when still valid (not expired)", async () => {
		await setCredential("test-provider", "accessToken", "tok-valid");
		// Expires in 1 hour
		const expiresAt = Date.now() + 60 * 60 * 1000;
		await setCredential(
			"test-provider",
			"expiresAt",
			String(expiresAt),
		);

		const token = await getValidAccessToken(CONFIG);
		expect(token).toBe("tok-valid");
		expect(global.fetch).not.toHaveBeenCalled();
	});

	it("refreshes token when within 5-minute buffer of expiry", async () => {
		await setCredential("test-provider", "accessToken", "tok-old");
		await setCredential("test-provider", "refreshToken", "refresh-123");
		// Expires in 2 minutes (within 5-min buffer)
		const expiresAt = Date.now() + 2 * 60 * 1000;
		await setCredential(
			"test-provider",
			"expiresAt",
			String(expiresAt),
		);

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				access_token: "tok-new",
				refresh_token: "refresh-456",
				expires_in: 3600,
			}),
		});

		const token = await getValidAccessToken(CONFIG);
		expect(token).toBe("tok-new");
		expect(global.fetch).toHaveBeenCalledWith(
			CONFIG.tokenUrl,
			expect.objectContaining({ method: "POST" }),
		);

		// Verify new tokens were stored
		const stored = await getCredential("test-provider", "accessToken");
		expect(stored).toBe("tok-new");
		const storedRefresh = await getCredential(
			"test-provider",
			"refreshToken",
		);
		expect(storedRefresh).toBe("refresh-456");
	});

	it("returns null when refresh token is missing and token expired", async () => {
		await setCredential("test-provider", "accessToken", "tok-expired");
		// Already expired
		const expiresAt = Date.now() - 1000;
		await setCredential(
			"test-provider",
			"expiresAt",
			String(expiresAt),
		);

		const token = await getValidAccessToken(CONFIG);
		expect(token).toBeNull();
	});

	it("returns null when refresh request fails", async () => {
		await setCredential("test-provider", "accessToken", "tok-expired");
		await setCredential("test-provider", "refreshToken", "refresh-bad");
		const expiresAt = Date.now() - 1000;
		await setCredential(
			"test-provider",
			"expiresAt",
			String(expiresAt),
		);

		(global.fetch as jest.Mock).mockResolvedValueOnce({
			ok: false,
			status: 401,
		});

		const token = await getValidAccessToken(CONFIG);
		expect(token).toBeNull();
	});
});
