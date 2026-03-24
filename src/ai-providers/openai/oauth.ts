import {
	setCredential,
} from "@/src/actions/secure-credentials";
import * as Linking from "expo-linking";
import type { Store } from "tinybase";

const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const DEVICE_CODE_URL =
	"https://auth.openai.com/api/accounts/deviceauth/usercode";
const DEVICE_TOKEN_URL =
	"https://auth.openai.com/api/accounts/deviceauth/token";
const OPENAI_TOKEN_URL = "https://auth.openai.com/oauth/token";
const DEVICE_AUTH_PAGE = "https://auth.openai.com/codex/device";
const DEVICE_AUTH_CALLBACK = "https://auth.openai.com/deviceauth/callback";

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export { OPENAI_CLIENT_ID, OPENAI_TOKEN_URL };

export interface DeviceCodeState {
	userCode: string;
	deviceAuthId: string;
	verificationUrl: string;
}

// Module-level abort controller so polling can be cancelled
let pollAbortController: AbortController | null = null;

/**
 * Step 1: Request a device code from OpenAI.
 * Returns the user code for display in the UI.
 */
export async function requestDeviceCode(
	store: Store,
): Promise<DeviceCodeState | null> {
	store.setCell("aiProviders", "openai", "status", "configuring");

	try {
		const response = await fetch(DEVICE_CODE_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ client_id: OPENAI_CLIENT_ID }),
		});

		if (!response.ok) {
			throw new Error(`Device code request failed: ${response.status}`);
		}

		const data = (await response.json()) as {
			device_auth_id: string;
			user_code: string;
			interval: string;
		};

		return {
			userCode: data.user_code,
			deviceAuthId: data.device_auth_id,
			verificationUrl: DEVICE_AUTH_PAGE,
		};
	} catch (error) {
		console.error("[OpenAI] Device code request failed:", error);
		const errorMessage =
			error instanceof Error
				? error.message
				: "Failed to get device code";
		store.setCell("aiProviders", "openai", "error", errorMessage);
		store.setCell("aiProviders", "openai", "status", "error");
		return null;
	}
}

/**
 * Step 2: Open the verification page in the user's browser.
 */
export function openVerificationPage(): void {
	Linking.openURL(DEVICE_AUTH_PAGE);
}

/**
 * Step 3: Poll for the user to complete authorization.
 * Resolves when the user authorizes, or rejects on timeout/cancel.
 */
export async function pollForAuthorization(
	store: Store,
	deviceAuthId: string,
	userCode: string,
): Promise<void> {
	// Cancel any existing poll
	pollAbortController?.abort();
	pollAbortController = new AbortController();
	const { signal } = pollAbortController;

	const startTime = Date.now();

	while (!signal.aborted) {
		if (Date.now() - startTime > POLL_TIMEOUT_MS) {
			store.setCell(
				"aiProviders",
				"openai",
				"error",
				"Authorization timed out",
			);
			store.setCell("aiProviders", "openai", "status", "error");
			return;
		}

		// Wait before polling
		await new Promise<void>((resolve) => {
			const timer = setTimeout(resolve, POLL_INTERVAL_MS);
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
			const response = await fetch(DEVICE_TOKEN_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					device_auth_id: deviceAuthId,
					user_code: userCode,
				}),
				signal,
			});

			if (response.ok) {
				const data = (await response.json()) as {
					authorization_code: string;
					code_verifier: string;
				};
				await exchangeCodeForToken(
					store,
					data.authorization_code,
					data.code_verifier,
				);
				return;
			}

			// 403/404 = still pending, keep polling
			if (response.status === 403 || response.status === 404) {
				continue;
			}

			// Other error
			throw new Error(`Unexpected poll response: ${response.status}`);
		} catch (error) {
			if (signal.aborted) return;
			// Network errors during polling — keep trying
			console.warn("[OpenAI] Poll error, retrying:", error);
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
 * Exchanges the authorization code for access + refresh tokens.
 */
async function exchangeCodeForToken(
	store: Store,
	code: string,
	codeVerifier: string,
): Promise<void> {
	try {
		const response = await fetch(OPENAI_TOKEN_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: OPENAI_CLIENT_ID,
				code,
				code_verifier: codeVerifier,
				redirect_uri: DEVICE_AUTH_CALLBACK,
			}).toString(),
		});

		if (!response.ok) {
			throw new Error(`Token exchange failed: ${response.status}`);
		}

		const data = (await response.json()) as {
			access_token: string;
			refresh_token?: string;
			expires_in?: number;
			id_token?: string;
		};

		await setCredential("openai", "accessToken", data.access_token);

		if (data.refresh_token) {
			await setCredential("openai", "refreshToken", data.refresh_token);
		}

		if (data.expires_in) {
			const expiresAt = Date.now() + data.expires_in * 1000;
			await setCredential("openai", "expiresAt", String(expiresAt));
		}

		// Extract account ID from JWT claims
		const accountId = extractAccountId(
			data.id_token ?? data.access_token,
		);
		if (accountId) {
			await setCredential("openai", "accountId", accountId);
		}

		store.setCell("aiProviders", "openai", "status", "ready");
		store.setCell("aiProviders", "openai", "error", "");
	} catch (error) {
		console.error("[OpenAI] Token exchange failed:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Token exchange failed";
		store.setCell("aiProviders", "openai", "error", errorMessage);
		store.setCell("aiProviders", "openai", "status", "error");
	}
}

/**
 * Extracts chatgpt_account_id from a JWT token's payload.
 */
function extractAccountId(token: string): string | null {
	try {
		const parts = token.split(".");
		if (parts.length !== 3) return null;
		const payload = JSON.parse(atob(parts[1])) as {
			chatgpt_account_id?: string;
			"https://api.openai.com/auth"?: {
				chatgpt_account_id?: string;
			};
			organizations?: Array<{ id: string }>;
		};
		return (
			payload.chatgpt_account_id ??
			payload["https://api.openai.com/auth"]?.chatgpt_account_id ??
			payload.organizations?.[0]?.id ??
			null
		);
	} catch {
		return null;
	}
}
