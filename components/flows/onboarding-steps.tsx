import { Icon } from "@/components/ui/icon";
import type { OnboardingStep } from "@/components/ui/onboarding";
import { Colors } from "@/theme/colors";
import { Bird, Rocket } from "lucide-react-native";
import { Logo } from "../logo";

export const onboardingSteps: OnboardingStep[] = [
	{
		id: "1",
		title: "Your On-Device AI",
		description: "100% Private AI chat, on your device.",
		icon: <Logo fontSize={72} />,
	},

	{
		id: "2",
		title: "Privacy You Deserve",
		description:
			"AI only runs on your device, even offline. Your chats stay 100% private.",
		icon: (
			<Icon
				name={Bird}
				size={128}
				lightColor={Colors.light.secondaryForeground}
				darkColor={Colors.dark.secondaryForeground}
				strokeWidth={1.35}
			/>
		),
	},
	{
		id: "3",
		title: "Get Started",
		description: "We will make Ava Chat yours and download the AIs you need.",
		icon: (
			<Icon
				name={Rocket}
				size={128}
				lightColor={Colors.light.secondaryForeground}
				darkColor={Colors.dark.secondaryForeground}
				strokeWidth={1.35}
			/>
		),
	},
];
