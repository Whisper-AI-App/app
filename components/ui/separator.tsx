import { View } from "react-native";
import { useColor } from "@/hooks/useColor";

interface SeparatorProps {
	style?: any;
}

export function Separator({ style }: SeparatorProps) {
	const borderColor = useColor("border");

	return (
		<View
			style={[
				{
					height: 1,
					backgroundColor: borderColor,
					opacity: 0.3,
					marginVertical: 16,
				},
				style,
			]}
		/>
	);
}
