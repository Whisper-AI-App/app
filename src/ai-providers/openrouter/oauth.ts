import * as Crypto from "expo-crypto";
import * as WebBrowser from "expo-web-browser";
import type { Store } from "tinybase";

const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
const OPENROUTER_KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";
const CALLBACK_WEB_URL = "https://usewhisper.org/callback/openrouter";
const CALLBACK_SCHEME = "whisper://callback/openrouter";

/**
 * Generates a cryptographically random string for PKCE code_verifier
 */
function generateCodeVerifier(): string {
	const randomBytes = Crypto.getRandomBytes(32);
	return bufferToBase64Url(randomBytes);
}

/**
 * Creates SHA-256 code_challenge from code_verifier
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
	const encoded = new TextEncoder().encode(verifier);
	const digest = await Crypto.digest(
		Crypto.CryptoDigestAlgorithm.SHA256,
		encoded,
	);
	// digest returns hex string, convert to bytes then base64url
	const bytes = hexToBytes(digest);
	return bufferToBase64Url(bytes);
}

function bufferToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

/**
 * Starts the OAuth PKCE flow with OpenRouter.
 *
 * 1. Generate code_verifier and code_challenge
 * 2. Store code_verifier in TinyBase
 * 3. Open browser with OpenRouter auth URL
 * 4. On return, extract code from URL params
 * 5. Exchange code for API key
 */
export async function startOAuth(store: Store): Promise<void> {
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = await generateCodeChallenge(codeVerifier);

	// Store code_verifier for exchange step
	store.setCell(
		"aiProviders",
		"openrouter",
		"oAuthCodeVerifier",
		codeVerifier,
	);
	store.setCell("aiProviders", "openrouter", "status", "configuring");

	const authUrl = `${OPENROUTER_AUTH_URL}?callback_url=${encodeURIComponent(CALLBACK_WEB_URL)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

	const result = await WebBrowser.openAuthSessionAsync(
		authUrl,
		CALLBACK_SCHEME,
	);

	if (result.type === "success" && result.url) {
		// Extract code from redirect URL
		const url = new URL(result.url);
		const code = url.searchParams.get("code");
		if (code) {
			await exchangeCodeForKey(store, code);
		} else {
			store.setCell(
				"aiProviders",
				"openrouter",
				"error",
				"No authorization code received",
			);
			store.setCell("aiProviders", "openrouter", "status", "error");
		}
	} else {
		// User cancelled
		store.setCell("aiProviders", "openrouter", "status", "needs_setup");
	}
}

/**
 * Handles OAuth callback from deep link (fallback path)
 */
export async function handleOAuthCallback(
	store: Store,
	params: Record<string, string>,
): Promise<void> {
	const code = params.code;
	if (!code) {
		store.setCell(
			"aiProviders",
			"openrouter",
			"error",
			"No authorization code in callback",
		);
		store.setCell("aiProviders", "openrouter", "status", "error");
		return;
	}
	await exchangeCodeForKey(store, code);
}

/**
 * Exchanges the authorization code for an API key
 */
async function exchangeCodeForKey(store: Store, code: string): Promise<void> {
	const codeVerifier = store.getCell(
		"aiProviders",
		"openrouter",
		"oAuthCodeVerifier",
	) as string;

	if (!codeVerifier) {
		store.setCell(
			"aiProviders",
			"openrouter",
			"error",
			"Missing code verifier",
		);
		store.setCell("aiProviders", "openrouter", "status", "error");
		return;
	}

	try {
		const response = await fetch(OPENROUTER_KEYS_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				code,
				code_verifier: codeVerifier,
				code_challenge_method: "S256",
			}),
		});

		if (!response.ok) {
			throw new Error(`Key exchange failed: ${response.status}`);
		}

		const data = (await response.json()) as { key: string };

		// Store API key and clean up
		store.setCell("aiProviders", "openrouter", "apiKey", data.key);
		store.setCell("aiProviders", "openrouter", "oAuthCodeVerifier", "");
		store.setCell("aiProviders", "openrouter", "status", "ready");
		store.setCell("aiProviders", "openrouter", "error", "");
	} catch (error) {
		console.error("[OpenRouter] Key exchange failed:", error);
		const errorMessage =
			error instanceof Error ? error.message : "Key exchange failed";
		store.setCell("aiProviders", "openrouter", "error", errorMessage);
		store.setCell("aiProviders", "openrouter", "status", "error");
	}
}
