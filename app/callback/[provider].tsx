import { View } from "@/components/ui/view";
import { Text } from "@/components/ui/text";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator } from "react-native";

/**
 * Fallback deep link handler for OAuth callbacks.
 *
 * The web page at https://usewhisper.org/callback/openrouter redirects to
 * whisper://callback/openrouter?code=XXX. If openAuthSessionAsync captures
 * the redirect inline, this route is never hit. But serves as a safety net.
 */
export default function OAuthCallback() {
	const router = useRouter();
	const { provider: providerId, code } = useLocalSearchParams<{
		provider: string;
		code?: string;
	}>();
	const { providers } = useAIProvider();

	useEffect(() => {
		const provider = providers.find((p) => p.id === providerId);
		if (!provider || !code) {
			router.replace("/dashboard");
			return;
		}

		provider
			.handleOAuthCallback?.({ code })
			.then(() => {
				router.replace(`/provider-setup/${providerId}`);
			})
			.catch(() => {
				router.replace("/dashboard");
			});
	}, [providerId, code, providers, router]);

	return (
		<View
			style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
		>
			<ActivityIndicator size="large" />
			<Text style={{ marginTop: 16, opacity: 0.6 }}>Connecting...</Text>
		</View>
	);
}
