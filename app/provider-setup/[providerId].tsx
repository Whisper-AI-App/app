import { AppleModelsSetup } from "@/components/provider-setup/AppleModelsSetup";
import { CustomProviderSetup } from "@/components/provider-setup/CustomProviderSetup";
import { HuggingFaceSetup } from "@/components/provider-setup/HuggingFaceSetup";
import { OpenAISetup } from "@/components/provider-setup/OpenAISetup";
import { OpenRouterSetup } from "@/components/provider-setup/OpenRouterSetup";
import { WhisperAISetup } from "@/components/provider-setup/WhisperAISetup";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useLocalSearchParams } from "expo-router";
import { useValue } from "tinybase/ui-react";

export default function ProviderSetup() {
	const { providerId, search } = useLocalSearchParams<{ providerId: string; search?: string }>();
	const onboardedAt = useValue("onboardedAt");

	if (providerId === "whisper-ai") return <WhisperAISetup />;
	if (providerId === "openrouter") return <OpenRouterSetup />;
	if (providerId === "openai") return <OpenAISetup />;
	if (providerId === "custom-provider") return <CustomProviderSetup />;
	if (providerId === "huggingface")
		return <HuggingFaceSetup initialSearch={search} onboarding={!onboardedAt} />;
	if (providerId === "apple-models") return <AppleModelsSetup />;

	return (
		<View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
			<Text>Unknown provider: {providerId}</Text>
		</View>
	);
}
