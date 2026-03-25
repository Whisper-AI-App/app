import { AppleModelsSetup } from "@/components/provider-setup/AppleModelsSetup";
import { CustomProviderSetup } from "@/components/provider-setup/CustomProviderSetup";
import { OpenAISetup } from "@/components/provider-setup/OpenAISetup";
import { OpenRouterSetup } from "@/components/provider-setup/OpenRouterSetup";
import { WhisperAISetup } from "@/components/provider-setup/WhisperAISetup";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useLocalSearchParams } from "expo-router";

export default function ProviderSetup() {
	const { providerId } = useLocalSearchParams<{ providerId: string }>();

	if (providerId === "whisper-ai") return <WhisperAISetup />;
	if (providerId === "openrouter") return <OpenRouterSetup />;
	if (providerId === "openai") return <OpenAISetup />;
	if (providerId === "custom-provider") return <CustomProviderSetup />;
	if (providerId === "apple-models") return <AppleModelsSetup />;

	return (
		<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
			<Text>Unknown provider: {providerId}</Text>
		</View>
	);
}
