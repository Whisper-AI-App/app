import type { LucideProps } from "lucide-react-native";
import type React from "react";
import { useThemeColor } from "@/hooks/useThemeColor";

export type Props = LucideProps & {
	lightColor?: string;
	darkColor?: string;
	name: React.ComponentType<LucideProps>;
};

export function Icon({
	lightColor,
	darkColor,
	name: IconComponent,
	color,
	size = 24,
	strokeWidth = 1.8,
	...rest
}: Props) {
	const themedColor = useThemeColor(
		{ light: lightColor, dark: darkColor },
		"icon",
	);

	// Use provided color prop if available, otherwise use themed color
	const iconColor = color || themedColor;

	return (
		<IconComponent
			color={iconColor}
			size={size}
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			{...rest}
		/>
	);
}
