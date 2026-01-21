import { FlappyBird } from "@/components/flappy-bird";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Game() {
	const router = useRouter();
	const backgroundColor = useColor("background");

	const handleClose = () => {
		router.back();
	};

	return (
		<View style={{ flex: 1, backgroundColor }}>
			<SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
				<FlappyBird onClose={handleClose} />
			</SafeAreaView>
		</View>
	);
}
