import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { CORNERS, FONT_SIZE, HEIGHT } from "@/theme/globals";
import { Search } from "lucide-react-native";
import type React from "react";
import {
	ActivityIndicator,
	type GestureResponderEvent,
	type TextStyle,
	TouchableOpacity,
	type ViewStyle,
} from "react-native";

interface SearchButtonProps {
	loading?: boolean;
	label?: string;
	leftIcon?: React.ReactNode;
	rightIcon?: React.ReactNode;
	containerStyle?: ViewStyle | ViewStyle[];
	textStyle?: TextStyle | TextStyle[];
	onPress?: (event: GestureResponderEvent) => void;
	disabled?: boolean;
}

export function SearchButton({
	loading = false,
	label = "Search",
	leftIcon,
	rightIcon,
	containerStyle,
	textStyle,
	onPress,
	disabled = false,
}: SearchButtonProps) {
	const cardColor = useColor("card");
	const textColor = useColor("text");
	const muted = useColor("textMuted");
	const icon = useColor("icon");

	const baseStyle: ViewStyle = {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: cardColor,
		height: HEIGHT,
		paddingHorizontal: 16,
		borderRadius: CORNERS,
		opacity: disabled ? 0.6 : 1,
	};

	const baseTextStyle: TextStyle = {
		flex: 1,
		fontSize: FONT_SIZE,
		color: muted,
		marginHorizontal: 8,
	};

	return (
		<TouchableOpacity
			style={[baseStyle, containerStyle]}
			onPress={onPress}
			activeOpacity={0.7}
			disabled={disabled || loading}
		>
			{/* Left Icon */}
			{leftIcon || <Icon name={Search} size={16} color={muted} />}

			{/* Label */}
			<Text style={[baseTextStyle, textStyle]} numberOfLines={1}>
				{label}
			</Text>

			{/* Loading Indicator */}
			{loading && (
				<ActivityIndicator
					size="small"
					color={muted}
					style={{ marginRight: 4 }}
				/>
			)}

			{/* Right Icon */}
			{!loading && rightIcon}
		</TouchableOpacity>
	);
}
