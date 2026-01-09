import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useColor } from "@/hooks/useColor";
import { useColorScheme } from "@/hooks/useColorScheme";
import { BORDER_RADIUS, CORNERS, FONT_SIZE, HEIGHT } from "@/theme/globals";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { LucideProps } from "lucide-react-native";
import React, { forwardRef, type ReactElement, useState } from "react";
import {
	Pressable,
	TextInput,
	type TextInputProps,
	type TextStyle,
	View,
	type ViewStyle,
} from "react-native";

export interface InputProps extends Omit<TextInputProps, "style"> {
	label?: string;
	error?: string;
	icon?: React.ComponentType<LucideProps>;
	rightComponent?: React.ReactNode | (() => React.ReactNode);
	containerStyle?: ViewStyle;
	inputStyle?: TextStyle;
	labelStyle?: TextStyle;
	errorStyle?: TextStyle;
	variant?: "filled" | "outline" | "chat";
	disabled?: boolean;
	type?: "input" | "textarea";
	placeholder?: string;
	rows?: number; // Only used when type="textarea"
}

export const Input = forwardRef<TextInput, InputProps>(
	(
		{
			label,
			error,
			icon,
			rightComponent,
			containerStyle,
			inputStyle,
			labelStyle,
			errorStyle,
			variant = "filled",
			disabled = false,
			type = "input",
			rows = 4,
			onFocus,
			onBlur,
			placeholder,
			...props
		},
		ref,
	) => {
		const [isFocused, setIsFocused] = useState(false);

		// Theme colors
		const theme = useColorScheme() ?? "light";
		const cardColor = useColor("card");
		const textColor = useColor("text");
		const muted = useColor("textMuted");
		const borderColor = useColor("border");
		const backgroundColor = useColor("card");
		const primary = useColor("primary");
		const danger = useColor("red");

		const isTextarea = type === "textarea" || props.multiline;

		// Variant styles
		const getVariantStyle = (): ViewStyle => {
			const baseStyle: ViewStyle = {
				borderRadius: isTextarea ? BORDER_RADIUS : CORNERS,
				flexDirection: isTextarea ? "column" : "row",
				alignItems: isTextarea ? "stretch" : "center",
				minHeight: isTextarea ? undefined : HEIGHT,
				paddingHorizontal: 16,
				paddingVertical: isTextarea ? 12 : 0,
			};

			switch (variant) {
				case "chat":
					return {
						...baseStyle,
						borderWidth: 1,
						borderColor: "rgba(100,100,100,0.2)",
						backgroundColor: isLiquidGlassAvailable()
							? "transparent"
							: theme === "light"
								? "rgba(245,245,245,0.95)"
								: "rgba(20,20,20,0.95)",
					};
				case "outline":
					return {
						...baseStyle,
						borderWidth: 1,
						borderColor: error ? danger : isFocused ? primary : borderColor,
						backgroundColor: backgroundColor,
					};
				case "filled":
				default:
					return {
						...baseStyle,
						borderWidth: 1,
						borderColor: error ? danger : cardColor,
						backgroundColor: disabled ? muted + "20" : cardColor,
					};
			}
		};

		const getInputStyle = (): TextStyle => ({
			flex: isTextarea ? undefined : 1,
			fontSize: FONT_SIZE,
			// lineHeight: isTextarea ? 16 : undefined,
			color: disabled ? muted : error ? danger : textColor,
			paddingVertical: 0, // Remove default padding
			textAlignVertical: isTextarea ? "top" : "center",
		});

		const handleFocus = (e: any) => {
			setIsFocused(true);
			onFocus?.(e);
		};

		const handleBlur = (e: any) => {
			setIsFocused(false);
			onBlur?.(e);
		};

		// Render right component - supports both direct components and functions
		const renderRightComponent = () => {
			if (!rightComponent) return null;

			// If it's a function, call it. Otherwise, render directly
			return typeof rightComponent === "function"
				? rightComponent()
				: rightComponent;
		};

		const renderInputContent = () => (
			<GlassView
				style={[
					containerStyle,
					{
						borderRadius: isTextarea ? BORDER_RADIUS : CORNERS,
					},
				]}
			>
				{/* Input Container */}
				<Pressable
					style={[getVariantStyle(), disabled && { opacity: 0.6 }]}
					onPress={() => {
						if (!disabled && ref && "current" in ref && ref.current) {
							ref.current.focus();
						}
					}}
					disabled={disabled}
				>
					{isTextarea ? (
						// Textarea Layout (Column)
						<>
							{/* Header section with icon, label, and right component */}
							{(icon || label || rightComponent) && (
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										marginBottom: 8,
										gap: 8,
									}}
								>
									{/* Left section - Icon + Label */}
									<View
										style={{
											flex: 1,
											flexDirection: "row",
											alignItems: "center",
											gap: 8,
										}}
										pointerEvents="none"
									>
										{icon && (
											<Icon
												name={icon}
												size={16}
												color={error ? danger : muted}
											/>
										)}
										{label && (
											<Text
												variant="caption"
												numberOfLines={1}
												ellipsizeMode="tail"
												style={[
													{
														color: error ? danger : muted,
													},
													labelStyle,
												]}
												pointerEvents="none"
											>
												{label}
											</Text>
										)}
									</View>

									{/* Right Component */}
									{renderRightComponent()}
								</View>
							)}

							{/* TextInput section */}

							<TextInput
								ref={ref}
								style={[
									getInputStyle(),
									inputStyle,
									{
										backgroundColor: "transparent",
										maxHeight: 200,
									},
								]}
								placeholderTextColor={error ? danger + "99" : muted}
								placeholder={placeholder || "Type your message..."}
								onFocus={handleFocus}
								onBlur={handleBlur}
								editable={!disabled}
								selectionColor={primary}
								multiline
								{...props}
							/>
						</>
					) : (
						// Input Layout (Row)
						<View
							style={{
								flexDirection: "row",
								alignItems: "center",
								gap: 8,
							}}
						>
							{/* Left section - Icon + Label (fixed width to simulate grid column) */}
							<View
								style={{
									width: label ? 120 : "auto",
									flexDirection: "row",
									alignItems: "center",
									gap: 8,
								}}
								pointerEvents="none"
							>
								{icon && (
									<Icon name={icon} size={16} color={error ? danger : muted} />
								)}
								{label && (
									<Text
										variant="caption"
										numberOfLines={1}
										ellipsizeMode="tail"
										style={[
											{
												color: error ? danger : muted,
											},
											labelStyle,
										]}
										pointerEvents="none"
									>
										{label}
									</Text>
								)}
							</View>

							{/* TextInput section - takes remaining space */}
							<View style={{ flex: 1 }}>
								<TextInput
									ref={ref}
									style={[getInputStyle(), inputStyle]}
									placeholderTextColor={error ? danger + 99 : muted}
									onFocus={handleFocus}
									onBlur={handleBlur}
									editable={!disabled}
									placeholder={placeholder}
									selectionColor={primary}
									{...props}
								/>
							</View>

							{/* Right Component */}
							{renderRightComponent()}
						</View>
					)}
				</Pressable>

				{/* Error Message */}
				{error && (
					<Text
						style={[
							{
								marginLeft: 14,
								marginTop: 4,
								fontSize: 14,
								color: danger,
							},
							errorStyle,
						]}
					>
						{error}
					</Text>
				)}
			</GlassView>
		);

		return renderInputContent();
	},
);

export interface GroupedInputProps {
	children: React.ReactNode;
	containerStyle?: ViewStyle;
	title?: string;
	titleStyle?: TextStyle;
}

export const GroupedInput = ({
	children,
	containerStyle,
	title,
	titleStyle,
}: GroupedInputProps) => {
	const border = useColor("border");
	const background = useColor("card");
	const danger = useColor("red");

	const childrenArray = React.Children.toArray(children);

	const errors = childrenArray
		.filter(
			(child): child is ReactElement<any> =>
				React.isValidElement(child) && !!(child.props as any).error,
		)
		.map((child) => child.props.error);

	const renderGroupedContent = () => (
		<View style={containerStyle}>
			{!!title && (
				<Text
					variant="title"
					style={[{ marginBottom: 8, marginLeft: 8 }, titleStyle]}
				>
					{title}
				</Text>
			)}

			<View
				style={{
					backgroundColor: background,
					borderColor: border,
					borderWidth: 1,
					borderRadius: BORDER_RADIUS,
					overflow: "hidden",
				}}
			>
				{childrenArray.map((child, index) => (
					<View
						key={index}
						style={{
							minHeight: HEIGHT,
							paddingVertical: 12,
							paddingHorizontal: 16,
							justifyContent: "center",
							borderBottomWidth: index !== childrenArray.length - 1 ? 1 : 0,
							borderColor: border,
						}}
					>
						{child}
					</View>
				))}
			</View>

			{errors.length > 0 && (
				<View style={{ marginTop: 6 }}>
					{errors.map((error, i) => (
						<Text
							key={i}
							style={{
								fontSize: 14,
								color: danger,
								marginTop: i === 0 ? 0 : 1,
								marginLeft: 8,
							}}
						>
							{error}
						</Text>
					))}
				</View>
			)}
		</View>
	);

	return renderGroupedContent();
};

export interface GroupedInputItemProps extends Omit<TextInputProps, "style"> {
	label?: string;
	error?: string;
	icon?: React.ComponentType<LucideProps>;
	rightComponent?: React.ReactNode | (() => React.ReactNode);
	inputStyle?: TextStyle;
	labelStyle?: TextStyle;
	errorStyle?: TextStyle;
	disabled?: boolean;
	type?: "input" | "textarea";
	rows?: number; // Only used when type="textarea"
}

export const GroupedInputItem = forwardRef<TextInput, GroupedInputItemProps>(
	(
		{
			label,
			error,
			icon,
			rightComponent,
			inputStyle,
			labelStyle,
			errorStyle,
			disabled,
			type = "input",
			rows = 3,
			onFocus,
			onBlur,
			placeholder,
			...props
		},
		ref,
	) => {
		const [isFocused, setIsFocused] = useState(false);

		const text = useColor("text");
		const muted = useColor("textMuted");
		const primary = useColor("primary");
		const danger = useColor("red");

		const isTextarea = type === "textarea" || props.multiline;

		const handleFocus = (e: any) => {
			setIsFocused(true);
			onFocus?.(e);
		};

		const handleBlur = (e: any) => {
			setIsFocused(false);
			onBlur?.(e);
		};

		const renderRightComponent = () => {
			if (!rightComponent) return null;
			return typeof rightComponent === "function"
				? rightComponent()
				: rightComponent;
		};

		const renderItemContent = () => (
			<Pressable
				onPress={() => ref && "current" in ref && ref.current?.focus()}
				disabled={disabled}
				style={{ opacity: disabled ? 0.6 : 1 }}
			>
				<View
					style={{
						flexDirection: isTextarea ? "column" : "row",
						alignItems: isTextarea ? "stretch" : "center",
						backgroundColor: "transparent",
					}}
				>
					{isTextarea ? (
						// Textarea Layout (Column)
						<>
							{/* Header section with icon, label, and right component */}
							{(icon || label || rightComponent) && (
								<View
									style={{
										flexDirection: "row",
										alignItems: "center",
										marginBottom: 8,
										gap: 8,
									}}
								>
									{/* Icon & Label */}
									<View
										style={{
											flex: 1,
											flexDirection: "row",
											alignItems: "center",
											gap: 8,
										}}
										pointerEvents="none"
									>
										{icon && (
											<Icon
												name={icon}
												size={16}
												color={error ? danger : muted}
											/>
										)}
										{label && (
											<Text
												variant="caption"
												numberOfLines={1}
												ellipsizeMode="tail"
												style={[
													{
														color: error ? danger : muted,
													},
													labelStyle,
												]}
												pointerEvents="none"
											>
												{label}
											</Text>
										)}
									</View>

									{/* Right Component */}
									{renderRightComponent()}
								</View>
							)}

							{/* Textarea Input */}
							<TextInput
								ref={ref}
								style={[
									{
										fontSize: FONT_SIZE,
										lineHeight: 20,
										color: disabled ? muted : error ? danger : text,
										textAlignVertical: "top",
										paddingVertical: 0,
										minHeight: 32,
										maxHeight: 200,
									},
									inputStyle,
								]}
								placeholderTextColor={error ? danger + "99" : muted}
								placeholder={placeholder || "Type your message..."}
								editable={!disabled}
								selectionColor={primary}
								onFocus={handleFocus}
								onBlur={handleBlur}
								multiline
								{...props}
							/>
						</>
					) : (
						// Input Layout (Row)
						<View
							style={{
								flex: 1,
								flexDirection: "row",
								alignItems: "center",
								gap: 8,
							}}
						>
							{/* Icon & Label */}
							<View
								style={{
									width: label ? 120 : "auto",
									flexDirection: "row",
									alignItems: "center",
									gap: 8,
								}}
								pointerEvents="none"
							>
								{icon && (
									<Icon name={icon} size={16} color={error ? danger : muted} />
								)}
								{label && (
									<Text
										variant="caption"
										numberOfLines={1}
										ellipsizeMode="tail"
										style={[
											{
												color: error ? danger : muted,
											},
											labelStyle,
										]}
										pointerEvents="none"
									>
										{label}
									</Text>
								)}
							</View>

							{/* Input */}
							<View style={{ flex: 1 }}>
								<TextInput
									ref={ref}
									style={[
										{
											flex: 1,
											fontSize: FONT_SIZE,
											color: disabled ? muted : error ? danger : text,
											paddingVertical: 0,
										},
										inputStyle,
									]}
									placeholder={placeholder}
									placeholderTextColor={error ? danger + "99" : muted}
									editable={!disabled}
									selectionColor={primary}
									onFocus={handleFocus}
									onBlur={handleBlur}
									{...props}
								/>
							</View>

							{/* Right Component */}
							{renderRightComponent()}
						</View>
					)}
				</View>
			</Pressable>
		);

		return renderItemContent();
	},
);
