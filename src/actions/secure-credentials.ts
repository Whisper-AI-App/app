import * as SecureStore from "expo-secure-store";

/**
 * Known credential fields per provider.
 * Used by getProviderCredentials and deleteProviderCredentials since
 * expo-secure-store does not support listing keys.
 */
const PROVIDER_CREDENTIAL_FIELDS: Record<string, string[]> = {
	openrouter: ["apiKey", "oAuthCodeVerifier"],
	"custom-provider": ["apiKey"],
	openai: ["accessToken", "refreshToken", "expiresAt", "accountId"],
};

function credentialKey(providerId: string, field: string): string {
	return `credential_${providerId}_${field}`;
}

export async function setCredential(
	providerId: string,
	field: string,
	value: string,
): Promise<void> {
	await SecureStore.setItemAsync(credentialKey(providerId, field), value);
}

export async function getCredential(
	providerId: string,
	field: string,
): Promise<string | null> {
	return SecureStore.getItemAsync(credentialKey(providerId, field));
}

export async function deleteCredential(
	providerId: string,
	field: string,
): Promise<void> {
	await SecureStore.deleteItemAsync(credentialKey(providerId, field));
}

export async function deleteProviderCredentials(
	providerId: string,
): Promise<void> {
	const fields = PROVIDER_CREDENTIAL_FIELDS[providerId] ?? [];
	await Promise.all(fields.map((field) => deleteCredential(providerId, field)));
}

export async function getProviderCredentials(
	providerId: string,
): Promise<Record<string, string>> {
	const fields = PROVIDER_CREDENTIAL_FIELDS[providerId] ?? [];
	const result: Record<string, string> = {};

	for (const field of fields) {
		const value = await getCredential(providerId, field);
		if (value !== null) {
			result[field] = value;
		}
	}

	return result;
}
