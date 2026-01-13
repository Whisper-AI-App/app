import type React from "react";
import { forwardRef } from "react";
import {
	Text as RNText,
	type TextProps as RNTextProps,
	type TextStyle,
} from "react-native";
import { useThemeColor } from "@/hooks/useThemeColor";
import { FONT_SIZE } from "@/theme/globals";

type TextVariant =
	| "body"
	| "title"
	| "subtitle"
	| "caption"
	| "heading"
	| "link"
	| "label";

interface TextProps extends RNTextProps {
	variant?: TextVariant;
	lightColor?: string;
	darkColor?: string;
	children: React.ReactNode;
}

export const Text = forwardRef<RNText, TextProps>(
	(
		{ variant = "body", lightColor, darkColor, style, children, ...props },
		ref,
	) => {
		const textColor = useThemeColor(
			{ light: lightColor, dark: darkColor },
			"text",
		);
		const mutedColor = useThemeColor({}, "textMuted");

		const getTextStyle = (): TextStyle => {
			const baseStyle: TextStyle = {
				color: textColor,
			};

			switch (variant) {
				case "heading":
					return {
						...baseStyle,
						fontSize: 28,
						fontWeight: "800",
					};
				case "title":
					return {
						...baseStyle,
						fontSize: 24,
						fontWeight: "700",
					};
				case "subtitle":
					return {
						...baseStyle,
						fontSize: 19,
						fontWeight: "600",
					};
				case "caption":
					return {
						...baseStyle,
						fontSize: FONT_SIZE,
						fontWeight: "400",
						color: mutedColor,
					};
				case "label":
					return {
						...baseStyle,
						fontSize: 13,
						fontWeight: "600",
						textTransform: "uppercase",
						color: mutedColor,
					};
				case "link":
					return {
						...baseStyle,
						fontSize: FONT_SIZE,
						fontWeight: "500",
						textDecorationLine: "underline",
					};
				default: // 'body'
					return {
						...baseStyle,
						fontSize: FONT_SIZE,
						fontWeight: "400",
					};
			}
		};

		return (
			<RNText ref={ref} style={[getTextStyle(), style]} {...props}>
				{children}
			</RNText>
		);
	},
);
