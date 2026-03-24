import {
	getCredential,
	setCredential,
} from "@/src/actions/secure-credentials";
import * as Linking from "expo-linking";
import type { Store } from "tinybase";

const CLIENT_ID = "Iv1.b507a08c87ecfe98";
const GITHUB_DOMAIN = "github.com";
const DEVICE_CODE_URL = `https://${GITHUB_DOMAIN}/login/device/code`;
const ACCESS_TOKEN_URL = `https://${GITHUB_DOMAIN}/login/oauth/access_token`;
const COPILOT_TOKEN_URL =
	"https://api.github.com/copilot_internal/v2/token";
const COPILOT_BASE_URL = "https://api.githubcopilot.com";
const VERIFICATION_URL = `https://${GITHUB_DOMAIN}/login/device`;

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export { COPILOT_BASE_URL };

/** Headers required by all Copilot API requests. */
export const COPILOT_HEADERS: Record<string, string> = {
	"User-Agent": "GitHubCopilotChat/0.35.0",
	"Editor-Version": "vscode/1.107.0",
	"Editor-Plugin-Version": "copilot-chat/0.35.0",
	"Copilot-Integration-Id": "vscode-chat",
};

export interface DeviceCodeState {
	userCode: string;
	deviceCode: string;
	verificationUrl: string;
	interval: number;
}

// Module-level abort controller for polling
let pollAbortController: AbortController | null = null;

// In-memory cache for short-lived Copilot API token
let cachedCopilotToken: {
	token: string;
	expiresAt: number;
	oauthToken: string;
} | null = null;

/**
 * Step 1: Request a device code from GitHub.
 */
export async function requestDeviceCode(
	store: Store,
): Promise<DeviceCodeState | null> {
	store.setCell("aiProviders", "github-copilot", "status", "configuring");

	try {
		const response = await fetch(DEVICE_CODE_URL, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				"User-Agent": "GitHubCopilotChat/0.35.0",
			},
			body: JSON.stringify({
				client_id: CLIENT_ID,
				scope: "read:user",
			}),
		});

		if (!response.ok) {
			throw new Error(`Device code request failed: ${response.status}`);
		}

		const data = (await response.json()) as {
			device_code: string;
			user_code: string;
			verification_uri: string;
			interval: number;
		};

		return {
			userCode: data.user_code,
			deviceCode: data.device_code,
			verificationUrl: data.verification_uri,
			interval:
				typeof data.interval === "number" ? data.interval : 5,
		};
	} catch (error) {
		console.error("[Copilot] Device code request failed:", error);
		const errorMessage =
			error instanceof Error
				? error.message
				: "Failed to get device code";
		store.setCell(
			"aiProviders",
			"github-copilot",
			"error",
			errorMessage,
		);
		store.setCell("aiProviders", "github-copilot", "status", "error");
		return null;
	}
}

/**
 * Open the GitHub device verification page in the user's browser.
 */
export function openVerificationPage(): void {
	Linking.openURL(VERIFICATION_URL);
}

/**
 * Step 2: Poll GitHub for the user to complete authorization.
 * Returns the long-lived GitHub OAuth token.
 */
export async function pollForAuthorization(
	store: Store,
	deviceCode: string,
	intervalSeconds: number,
): Promise<void> {
	pollAbortController?.abort();
	pollAbortController = new AbortController();
	const { signal } = pollAbortController;

	const intervalMs = Math.max(intervalSeconds * 1000, POLL_INTERVAL_MS);
	const startTime = Date.now();

	while (!signal.aborted) {
		if (Date.now() - startTime > POLL_TIMEOUT_MS) {
			store.setCell(
				"aiProviders",
				"github-copilot",
				"error",
				"Authorization timed out",
			);
			store.setCell(
				"aiProviders",
				"github-copilot",
				"status",
				"error",
			);
			return;
		}

		// Wait before polling
		await new Promise<void>((resolve) => {
			const timer = setTimeout(resolve, intervalMs);
			signal.addEventListener(
				"abort",
				() => {
					clearTimeout(timer);
					resolve();
				},
				{ once: true },
			);
		});

		if (signal.aborted) return;

		try {
			const response = await fetch(ACCESS_TOKEN_URL, {
				method: "POST",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
					"User-Agent": "GitHubCopilotChat/0.35.0",
				},
				body: JSON.stringify({
					client_id: CLIENT_ID,
					device_code: deviceCode,
					grant_type:
						"urn:ietf:params:oauth:grant-type:device_code",
				}),
				signal,
			});

			if (!response.ok) {
				throw new Error(
					`Token exchange failed: ${response.status}`,
				);
			}

			const data = (await response.json()) as {
				access_token?: string;
				error?: string;
			};

			if (data.access_token) {
				// Clear any stale Copilot API token from a previous account
				cachedCopilotToken = null;
				// Store the long-lived GitHub OAuth token
				await setCredential(
					"github-copilot",
					"oauthToken",
					data.access_token,
				);
				store.setCell(
					"aiProviders",
					"github-copilot",
					"status",
					"ready",
				);
				store.setCell(
					"aiProviders",
					"github-copilot",
					"error",
					"",
				);
				return;
			}

			if (data.error === "authorization_pending") {
				continue;
			}

			if (data.error === "expired_token") {
				store.setCell(
					"aiProviders",
					"github-copilot",
					"error",
					"Device code expired. Please try again.",
				);
				store.setCell(
					"aiProviders",
					"github-copilot",
					"status",
					"error",
				);
				return;
			}

			if (data.error === "slow_down") {
				// RFC 8628: increase poll interval by 5 seconds
				await new Promise<void>((resolve) => {
					const timer = setTimeout(resolve, 5000);
					signal.addEventListener(
						"abort",
						() => {
							clearTimeout(timer);
							resolve();
						},
						{ once: true },
					);
				});
				continue;
			}

			if (data.error) {
				store.setCell(
					"aiProviders",
					"github-copilot",
					"error",
					`Authorization failed: ${data.error}`,
				);
				store.setCell(
					"aiProviders",
					"github-copilot",
					"status",
					"error",
				);
				return;
			}
		} catch (error) {
			if (signal.aborted) return;
			console.warn("[Copilot] Poll error, retrying:", error);
		}
	}
}

/**
 * Cancel an in-progress device code poll.
 */
export function cancelPolling(): void {
	pollAbortController?.abort();
	pollAbortController = null;
}

/**
 * Get a short-lived Copilot API token by exchanging the stored GitHub OAuth token.
 * Caches the result in memory with a 5-minute expiry buffer.
 */
export async function getCopilotApiToken(): Promise<string | null> {
	const oauthToken = await getCredential("github-copilot", "oauthToken");
	if (!oauthToken) return null;

	// Check in-memory cache
	if (
		cachedCopilotToken &&
		cachedCopilotToken.oauthToken === oauthToken &&
		cachedCopilotToken.expiresAt > Date.now()
	) {
		return cachedCopilotToken.token;
	}

	try {
		const response = await fetch(COPILOT_TOKEN_URL, {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${oauthToken}`,
				...COPILOT_HEADERS,
			},
		});

		if (!response.ok) {
			console.error(
				`[Copilot] Token refresh failed: ${response.status}`,
			);
			return null;
		}

		const data = (await response.json()) as {
			token?: string;
			expires_at?: number;
		};

		if (!data.token) {
			console.error(
				"[Copilot] No token in response — subscription may not include chat access",
			);
			return null;
		}

		// Cache with 5-minute buffer before actual expiry
		const expiresAt = (data.expires_at ?? 0) * 1000 - 5 * 60 * 1000;
		cachedCopilotToken = {
			token: data.token,
			expiresAt,
			oauthToken,
		};

		return data.token;
	} catch (error) {
		console.error("[Copilot] Token refresh failed:", error);
		return null;
	}
}

/**
 * Clear the in-memory Copilot token cache.
 */
export function clearCopilotTokenCache(): void {
	cachedCopilotToken = null;
}
