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
	const activeProviderId = useValue("activeProviderId") as string | undefined;

	useEffect(() => {
		if (onboardedAt) {
			if (activeProviderId) {
				router.replace("/dashboard");
			} else {
				// Onboarded but no provider set up - go to setup-ai
				router.replace("/setup-ai");
			}
		}
	}, [onboardedAt, activeProviderId]);

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
						router.replace("/setup-ai");
					}}
					showSkip={false}
				/>
			</SafeAreaView>
		</View>
	);
}
