import * as Network from "expo-network";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * Hook that monitors network connectivity state.
 * Returns whether the device is currently connected to the internet.
 */
export function useNetworkState() {
	const [isConnected, setIsConnected] = useState(true);

	useEffect(() => {
		let mounted = true;

		const checkNetwork = async () => {
			try {
				const state = await Network.getNetworkStateAsync();
				if (mounted) {
					setIsConnected(state.isInternetReachable ?? state.isConnected ?? true);
				}
			} catch {
				// Assume connected if check fails
			}
		};

		checkNetwork();

		// Re-check when app returns to foreground
		const subscription = AppState.addEventListener("change", (nextState) => {
			if (nextState === "active") {
				checkNetwork();
			}
		});

		// Poll periodically (every 30s) for connectivity changes
		const interval = setInterval(checkNetwork, 30_000);

		return () => {
			mounted = false;
			subscription.remove();
			clearInterval(interval);
		};
	}, []);

	return { isConnected };
}
