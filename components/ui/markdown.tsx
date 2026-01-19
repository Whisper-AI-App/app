import RNMarkdown, { type MarkedStyles } from "react-native-marked";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import { View } from "./view";

interface MarkdownProps {
	children: string;
}

/**
 * Custom Markdown component that integrates with the app's theme system.
 * Supports both light and dark modes with consistent styling.
 */
export function Markdown({ children }: MarkdownProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	// Create theme configuration for react-native-marked
	const markedTheme = {
		colors: {
			text: theme.text,
			link: theme.blue,
			border: theme.border,
			code: theme.card,
			blockquoteText: theme.mutedForeground,
			blockquoteBorder: theme.border,
		},
	};

	// Create custom styles for markdown elements
	const markedStyles: MarkedStyles = {
		link: {
			textDecorationLine: "underline",
		},
		paragraph: {
			marginVertical: 4,
			marginHorizontal: 8,
		},
		h1: {
			marginVertical: 12,
			marginHorizontal: 8,
		},
		h2: {
			marginVertical: 10,
			marginHorizontal: 8,
		},
		h3: {
			marginVertical: 8,
			marginHorizontal: 8,
		},
		h4: {
			marginVertical: 8,
			marginHorizontal: 8,
		},
		h5: {
			marginVertical: 6,
			marginHorizontal: 8,
		},
		h6: {
			marginVertical: 6,
			marginHorizontal: 8,
		},
		codespan: {
			paddingHorizontal: 6,
			paddingVertical: 2,
			borderRadius: 4,
			minWidth: 0,
			flexShrink: 1,
			overflow: "hidden",
		},
		code: {
			marginVertical: 6,
			marginHorizontal: 6,
			padding: 16,
			borderRadius: 12,
			minWidth: 0,
			flexShrink: 1,
			overflow: "hidden",
		},
		blockquote: {
			marginVertical: 8,
			marginHorizontal: 8,
			paddingLeft: 12,
			borderLeftWidth: 4,
		},
		table: {
			marginVertical: 8,
			marginHorizontal: 8,
		},
		hr: {
			marginVertical: 16,
			marginHorizontal: 8,
		},
	};

	return (
		<View style={{ paddingHorizontal: 2, overflow: "hidden", flexShrink: 1 }}>
			<RNMarkdown
				value={children}
				theme={markedTheme}
				styles={markedStyles}
				flatListProps={{
					scrollEnabled: false,
					style: { flexShrink: 1 },
					contentContainerStyle: { flexShrink: 1 },
				}}
			/>
		</View>
	);
}
