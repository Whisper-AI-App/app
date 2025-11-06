import { Bird, Rocket } from "lucide-react-native";
import { Icon } from "@/components/ui/icon";
import type { OnboardingStep } from "@/components/ui/onboarding";
import { Colors } from "@/theme/colors";
import { Logo } from "../logo";

export const onboardingSteps: OnboardingStep[] = [
	{
		id: "1",
		title: "Your On-Device AI",
		description:
			"Private conversations. No servers. No tracking. Your thoughts stay 100% yours.",
		icon: <Logo fontSize={72} />,
	},

	{
		id: "2",
		title: "Privacy You Deserve",
		description:
			"Whisper never sends data to the cloud. It works even offline — your chats never leave your device.",
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
		description:
			"We'll prepare your private AI by downloading the model locally. Once ready, you can start chatting — privately, instantly.",
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
