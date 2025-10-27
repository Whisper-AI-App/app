import Animated, { FadeInUp, FadeOutDown } from "react-native-reanimated";

import { Text } from "./ui/text";

export function Logo({ fontSize }: { fontSize: number }) {
	return (
		<Animated.View
			entering={FadeInUp}
			exiting={FadeOutDown}
			style={[
				{
					flex: 1,
					justifyContent: "center",
					alignItems: "center",
					paddingBottom: fontSize * 0.85,
				},
			]}
		>
			<Text style={{ fontFamily: "Inter_500Medium", fontSize }}>Whisper.</Text>
			<Text
				style={{ fontFamily: "Inter_500Medium", fontSize: fontSize * 0.311 }}
			>
				Talk freely. Think privately.
			</Text>
		</Animated.View>
	);
}
