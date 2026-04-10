import { getCredential, setCredential } from "@/src/actions/secure-credentials";
import { createLogger } from "@/src/logger";

const logger = createLogger("TokenRefresh");

const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

interface RefreshConfig {
	providerId: string;
	tokenUrl: string;
	clientId: string;
}

/**
 * Checks whether the stored access token is still valid.
 * Returns the cached token if valid, or refreshes it if expired / about to expire.
 */
export async function getValidAccessToken(
	config: RefreshConfig,
): Promise<string | null> {
	const accessToken = await getCredential(config.providerId, "accessToken");
	if (!accessToken) return null;

	const expiresAtStr = await getCredential(config.providerId, "expiresAt");
	if (!expiresAtStr) return accessToken; // No expiry tracked — assume valid

	const expiresAt = Number(expiresAtStr);
	if (Date.now() < expiresAt - REFRESH_BUFFER_MS) {
		return accessToken; // Still valid
	}

	// Token expired or about to expire — refresh
	return refreshAccessToken(config);
}

/**
 * Exchanges a refresh token for a new access token.
 */
async function refreshAccessToken(
	config: RefreshConfig,
): Promise<string | null> {
	const refreshToken = await getCredential(config.providerId, "refreshToken");
	if (!refreshToken) return null;

	try {
		const response = await fetch(config.tokenUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "refresh_token",
				refresh_token: refreshToken,
				client_id: config.clientId,
			}).toString(),
		});

		if (!response.ok) {
			logger.error("Refresh failed", {
				providerId: config.providerId,
				status: response.status,
			});
			return null;
		}

		const data = (await response.json()) as {
			access_token: string;
			refresh_token?: string;
			expires_in?: number;
		};

		await setCredential(config.providerId, "accessToken", data.access_token);

		// Some providers rotate refresh tokens
		if (data.refresh_token) {
			await setCredential(
				config.providerId,
				"refreshToken",
				data.refresh_token,
			);
		}

		if (data.expires_in) {
			const expiresAt = Date.now() + data.expires_in * 1000;
			await setCredential(config.providerId, "expiresAt", String(expiresAt));
		}

		return data.access_token;
	} catch (error) {
		logger.error("Refresh failed", {
			providerId: config.providerId,
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}
