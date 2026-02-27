import { OpenRouterSetup } from "@/components/provider-setup/OpenRouterSetup";
import { WhisperAISetup } from "@/components/provider-setup/WhisperAISetup";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useLocalSearchParams } from "expo-router";

export default function ProviderSetup() {
	const { providerId } = useLocalSearchParams<{ providerId: string }>();

	if (providerId === "whisper-ai") return <WhisperAISetup />;
	if (providerId === "openrouter") return <OpenRouterSetup />;

	return (
		<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
			<Text>Unknown provider: {providerId}</Text>
		</View>
	);
}
