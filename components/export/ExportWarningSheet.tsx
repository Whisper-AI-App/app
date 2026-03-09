import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useColor } from "@/hooks/useColor";
import { Colors } from "@/theme/colors";
import { BORDER_RADIUS } from "@/theme/globals";
import { ShieldAlert } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, Switch, useColorScheme } from "react-native";

interface ExportWarningSheetProps {
	visible: boolean;
	onDismiss: () => void;
	onConfirm: (includeSensitiveData: boolean) => void;
}

export function ExportWarningSheet({
	visible,
	onDismiss,
	onConfirm,
}: ExportWarningSheetProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const background = useColor("background");
	const cardColor = useColor("card");
	const textMuted = useColor("textMuted");
	const [includeSensitive, setIncludeSensitive] = useState(false);

	const handleConfirm = () => {
		onConfirm(includeSensitive);
		setIncludeSensitive(false);
	};

	const handleDismiss = () => {
		setIncludeSensitive(false);
		onDismiss();
	};

	return (
		<Modal
			visible={visible}
			transparent
			animationType="fade"
			onRequestClose={handleDismiss}
			statusBarTranslucent
		>
			<Pressable
				style={{
					flex: 1,
					backgroundColor: "rgba(0,0,0,0.5)",
					justifyContent: "center",
					alignItems: "center",
					padding: 24,
				}}
				onPress={handleDismiss}
			>
				<Pressable
					style={{
						backgroundColor: background,
						borderRadius: BORDER_RADIUS,
						padding: 24,
						width: "100%",
						maxWidth: 400,
					}}
					onPress={() => {}}
				>
					<View
						style={{
							alignItems: "center",
							marginBottom: 16,
						}}
					>
						<ShieldAlert
							color={theme.orange ?? "#f59e0b"}
							size={40}
							strokeWidth={1.5}
						/>
					</View>

					<Text
						variant="title"
						style={{
							textAlign: "center",
							fontSize: 20,
							marginBottom: 8,
						}}
					>
						Export Warning
					</Text>

					<Text
						style={{
							textAlign: "center",
							fontSize: 14,
							lineHeight: 20,
							color: textMuted,
							marginBottom: 20,
						}}
					>
						The exported file will not be encrypted. Anyone with access to the
						file can read your conversations.
					</Text>

					{/* Sensitive data toggle */}
					<View
						style={{
							flexDirection: "row",
							alignItems: "center",
							justifyContent: "space-between",
							backgroundColor: cardColor,
							borderRadius: BORDER_RADIUS / 2,
							padding: 14,
							marginBottom: 12,
						}}
					>
						<View style={{ flex: 1, marginRight: 12 }}>
							<Text style={{ fontSize: 14, fontWeight: "500" }}>
								Include API keys
							</Text>
							<Text
								style={{
									fontSize: 12,
									color: textMuted,
									marginTop: 2,
								}}
							>
								Include your provider credentials in the export
							</Text>
						</View>
						<Switch
							value={includeSensitive}
							onValueChange={setIncludeSensitive}
							trackColor={{
								false: theme.muted,
								true: theme.orange ?? "#f59e0b",
							}}
							thumbColor={theme.background}
							ios_backgroundColor={theme.muted}
						/>
					</View>

					{includeSensitive && (
						<Text
							style={{
								fontSize: 12,
								color: theme.destructive,
								textAlign: "center",
								marginBottom: 12,
								lineHeight: 16,
							}}
						>
							Your API keys will be visible in plain text in the exported file.
						</Text>
					)}

					<View style={{ gap: 8, marginTop: 4 }}>
						<Button onPress={handleConfirm}>Export</Button>
						<Button variant="ghost" onPress={handleDismiss}>
							Cancel
						</Button>
					</View>
				</Pressable>
			</Pressable>
		</Modal>
	);
}
