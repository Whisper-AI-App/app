import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { saveBackupData } from "@/src/actions/reset";
import { Colors } from "@/theme/colors";
import * as Updates from "expo-updates";
import { AlertTriangle, RefreshCw, Save, Trash2 } from "lucide-react-native";
import { useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GradientBackground } from "./gradient-background";
import { Separator } from "./ui/separator";

interface MigrationErrorScreenProps {
	error: Error;
	onReset: () => Promise<void>;
}

/**
 * Error screen displayed when state migrations fail.
 * Provides options to retry (reload app) or reset all data.
 */
export function MigrationErrorScreen({
	error,
	onReset,
}: MigrationErrorScreenProps) {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	const handleTryAgain = async () => {
		// Reload the app to retry migrations
		if (Updates.reloadAsync) {
			await Updates.reloadAsync();
		}
	};

	const handleReset = async () => {
		await onReset();
		// Reload after reset
		if (Updates.reloadAsync) {
			await Updates.reloadAsync();
		}
	};

	return (
		<View style={{ flex: 1, backgroundColor: theme.background }}>
			<GradientBackground variant="simple" />
			<SafeAreaView
				style={{
					flex: 1,
					paddingTop: 40,
					paddingBottom: 40,
				}}
			>
				<View
					style={{
						flex: 1,
						justifyContent: "center",
						alignItems: "center",
						paddingHorizontal: 32,
					}}
				>
					<View
						style={{
							width: 80,
							height: 80,
							borderRadius: 40,
							backgroundColor: `${theme.destructive}20`,
							justifyContent: "center",
							alignItems: "center",
							marginBottom: 24,
						}}
					>
						<AlertTriangle
							color={theme.destructive}
							size={40}
							strokeWidth={1.5}
						/>
					</View>

					<Text
						style={{
							fontSize: 22,
							fontWeight: "600",
							textAlign: "center",
							marginBottom: 12,
						}}
					>
						Unable to Update
					</Text>

					<Text
						style={{
							fontSize: 15,
							color: theme.text,
							textAlign: "center",
							marginBottom: 24,
							lineHeight: 22,
						}}
					>
						We tried to update your data for the version of Whisper you have
						installed.
					</Text>

					<Text
						style={{
							fontSize: 15,
							color: theme.text,
							textAlign: "center",
							marginBottom: 24,
							lineHeight: 22,
						}}
					>
						There was a critical problem. You can try again or reset the app to
						start fresh.
					</Text>

					<View style={{ gap: 12, width: "100%", marginTop: "auto" }}>
						<Button
							variant="default"
							onPress={handleTryAgain}
							icon={RefreshCw}
							size="lg"
						>
							Try Again
						</Button>

						<Button variant="secondary" onPress={saveBackupData} icon={Save}>
							Save Backup
						</Button>

						<Separator />

						<View>
							<Button variant="destructive" onPress={handleReset} icon={Trash2}>
								Reset Everything
							</Button>

							<Text
								style={{
									fontSize: 14,
									color: theme.text,
									textAlign: "center",
									marginTop: 16,
									lineHeight: 18,
								}}
							>
								Resetting will delete all chats, settings, and data from this
								phone. There's no recovery.
							</Text>
						</View>
					</View>
				</View>
			</SafeAreaView>
		</View>
	);
}
