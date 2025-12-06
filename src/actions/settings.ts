import * as LocalAuthentication from "expo-local-authentication";
import { store } from "../store";

export function setName(value: string) {
	store.setValue("name", value);
}

export function completeOnboarding(value: boolean = true) {
	if (value === false) {
		store.delValue("onboardedAt");
		return;
	}

	store.setValue("onboardedAt", new Date().toISOString());
}

export function setLocalAuth(enabled: boolean) {
	store.setValue("localAuthEnabled", enabled);
}

export async function checkLocalAuthAvailable(): Promise<{
	hasHardware: boolean;
	isEnrolled: boolean;
	available: boolean;
}> {
	const hasHardware = await LocalAuthentication.hasHardwareAsync();
	const isEnrolled = await LocalAuthentication.isEnrolledAsync();
	return {
		hasHardware,
		isEnrolled,
		available: hasHardware && isEnrolled,
	};
}

export async function authenticate(): Promise<{
	success: boolean;
	error?: string;
}> {
	const result = await LocalAuthentication.authenticateAsync({
		promptMessage: "Unlock Whisper",
		disableDeviceFallback: false,
		cancelLabel: "Cancel",
	});

	if (result.success) {
		return { success: true };
	}

	return { success: false, error: result.error };
}
