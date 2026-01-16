import * as LocalAuthentication from "expo-local-authentication";
import { store } from "../stores/store";

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

function getFriendlyAuthError(errorCode: string | undefined): string {
	switch (errorCode) {
		case "user_cancel":
			return "Authentication cancelled";
		case "user_fallback":
			return "Please try again";
		case "system_cancel":
			return "Authentication was interrupted";
		case "not_enrolled":
			return "No biometrics enrolled on this device";
		case "passcode_not_set":
			return "Please set up a device passcode first";
		case "not_available":
			return "Biometric authentication is not available";
		case "lockout":
			return "Too many failed attempts. Please try again later";
		case "lockout_permanent":
			return "Biometrics disabled. Use your device passcode";
		default:
			return "Authentication failed. Please try again";
	}
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

	return { success: false, error: getFriendlyAuthError(result.error) };
}
