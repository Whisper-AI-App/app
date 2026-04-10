import * as Device from "expo-device";
import { Platform } from "react-native";

const DEV_PROXY_PORT = 8787;

/**
 * In dev mode on emulators/simulators, routes the URL through a local
 * caching proxy to avoid re-downloading large model files.
 * On physical devices and in production the URL is returned unchanged.
 */
export function maybeProxyUrl(url: string): string {
	if (!__DEV__ || Device.isDevice) return url;
	const host = Platform.OS === "android" ? "10.0.2.2" : "localhost";
	return `http://${host}:${DEV_PROXY_PORT}/proxy?url=${encodeURIComponent(url)}`;
}
