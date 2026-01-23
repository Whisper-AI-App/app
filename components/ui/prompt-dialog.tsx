import { useState } from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	TextInput,
} from "react-native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Colors } from "@/theme/colors";
import { Text } from "./text";
import { View } from "./view";

interface PromptDialogProps {
	visible: boolean;
	title: string;
	message?: string;
	placeholder?: string;
	defaultValue?: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: (value: string) => void;
	onCancel: () => void;
}

export function PromptDialog({
	visible,
	title,
	message,
	placeholder = "",
	defaultValue = "",
	confirmText = "OK",
	cancelText = "Cancel",
	onConfirm,
	onCancel,
}: PromptDialogProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const [inputValue, setInputValue] = useState(defaultValue);

	const handleConfirm = () => {
		onConfirm(inputValue);
		setInputValue("");
	};

	const handleCancel = () => {
		onCancel();
		setInputValue("");
	};

	// Reset input value when dialog opens with new default
	const handleShow = () => {
		setInputValue(defaultValue);
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onShow={handleShow}
			onRequestClose={handleCancel}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === "ios" ? "padding" : "height"}
				style={{ flex: 1 }}
			>
				<Pressable
					onPress={handleCancel}
					style={{
						flex: 1,
						backgroundColor: "rgba(0,0,0,0.5)",
						justifyContent: "center",
						alignItems: "center",
						padding: 24,
					}}
				>
					<Pressable
						onPress={(e) => e.stopPropagation()}
						style={{
							backgroundColor: theme.card,
							borderRadius: 14,
							width: "100%",
							maxWidth: 320,
							overflow: "hidden",
						}}
					>
						<View style={{ padding: 20, gap: 12 }}>
							<Text
								style={{
									fontSize: 17,
									fontWeight: "600",
									textAlign: "center",
									color: theme.text,
								}}
							>
								{title}
							</Text>

							{message && (
								<Text
									style={{
										fontSize: 13,
										textAlign: "center",
										color: theme.textMuted,
									}}
								>
									{message}
								</Text>
							)}

							<TextInput
								value={inputValue}
								onChangeText={setInputValue}
								placeholder={placeholder}
								placeholderTextColor={theme.textMuted}
								autoFocus
								style={{
									backgroundColor:
										colorScheme === "dark"
											? "rgba(255,255,255,0.1)"
											: "rgba(0,0,0,0.06)",
									borderRadius: 10,
									paddingHorizontal: 14,
									paddingVertical: 12,
									fontSize: 16,
									color: theme.text,
									marginTop: 4,
								}}
								onSubmitEditing={handleConfirm}
								selectTextOnFocus
							/>
						</View>

						<View
							style={{
								flexDirection: "row",
								borderTopWidth: 1,
								borderTopColor:
									colorScheme === "dark"
										? "rgba(255,255,255,0.1)"
										: "rgba(0,0,0,0.1)",
							}}
						>
							<Pressable
								onPress={handleCancel}
								style={({ pressed }) => ({
									flex: 1,
									paddingVertical: 14,
									alignItems: "center",
									borderRightWidth: 1,
									borderRightColor:
										colorScheme === "dark"
											? "rgba(255,255,255,0.1)"
											: "rgba(0,0,0,0.1)",
									opacity: pressed ? 0.6 : 1,
								})}
							>
								<Text
									style={{
										fontSize: 17,
										color: theme.primary,
									}}
								>
									{cancelText}
								</Text>
							</Pressable>

							<Pressable
								onPress={handleConfirm}
								disabled={!inputValue.trim()}
								style={({ pressed }) => ({
									flex: 1,
									paddingVertical: 14,
									alignItems: "center",
									opacity: !inputValue.trim() ? 0.4 : pressed ? 0.6 : 1,
								})}
							>
								<Text
									style={{
										fontSize: 17,
										fontWeight: "600",
										color: theme.primary,
									}}
								>
									{confirmText}
								</Text>
							</Pressable>
						</View>
					</Pressable>
				</Pressable>
			</KeyboardAvoidingView>
		</Modal>
	);
}
