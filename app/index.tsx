import { useRouter } from "expo-router";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useValue } from "tinybase/ui-react";
import { onboardingSteps } from "@/components/flows/onboarding-steps";
import { GradientBackground } from "@/components/gradient-background";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Onboarding } from "@/components/ui/onboarding";
import { View } from "@/components/ui/view";

export default function Index() {
	const router = useRouter();
	const onboardedAt = useValue("onboardedAt");
	const downloadedAt = useValue("ai_chat_model_downloadedAt");

	useEffect(() => {
		if (onboardedAt) {
			// If onboarded but model not downloaded, go to download page
			if (!downloadedAt) {
				router.replace("/download");
			} else {
				router.replace("/dashboard");
			}
		}
	}, [onboardedAt, downloadedAt]);

	return (
		<View style={{ flex: 1 }}>
			<GradientBackground variant="simple" />
			<SafeAreaView style={{ flex: 1 }}>
				<View
					style={{
						width: "100%",
						justifyContent: "flex-end",
						alignItems: "flex-end",
						flexDirection: "row",
						padding: 16,
					}}
				>
					<ModeToggle />
				</View>

				<Onboarding
					steps={onboardingSteps}
					onComplete={() => {
						router.replace("/download");
					}}
					showSkip={false}
				/>
			</SafeAreaView>
		</View>
	);
}
