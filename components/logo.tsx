import { Text } from "./ui/text";
import { View } from "./ui/view";

export function Logo({ fontSize }: { fontSize: number }) {
	return (
		<View
			style={{
				flex: 1,
				justifyContent: "center",
				alignItems: "center",
				paddingBottom: fontSize * 0.85,
			}}
		>
			<Text style={{ fontFamily: "Inter_500Medium", fontSize }}>Whisper.</Text>
			<Text
				style={{ fontFamily: "Inter_500Medium", fontSize: fontSize * 0.311 }}
			>
				Talk freely. Think privately.
			</Text>
		</View>
	);
}
