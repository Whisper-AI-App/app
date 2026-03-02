import { GradientBackground } from "@/components/gradient-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { useRouter } from "expo-router";
import { fetch as expoFetch } from "expo/fetch";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCell, useStore } from "tinybase/ui-react";

export function OpenAISetup() {
	const router = useRouter();
	const store = useStore();
	const { setActiveProvider } = useAIProvider();

	const [keyInput, setKeyInput] = useState("");
	const [isValidating, setIsValidating] = useState(false);
	const [validationError, setValidationError] = useState("");

	const error = useCell("aiProviders", "openai", "error") as string | undefined;
	const apiKey = useCell("aiProviders", "openai", "apiKey") as
		| string
		| undefined;

	const handleValidateAndSave = async () => {
		if (!keyInput.trim() || !store) return;

		setIsValidating(true);
		setValidationError("");

		try {
			const response = await expoFetch("https://api.openai.com/v1/models", {
				headers: { Authorization: `Bearer ${keyInput.trim()}` },
			});

			if (!response.ok) {
				throw new Error("Invalid API key. Please check and try again.");
			}

			store.setCell("aiProviders", "openai", "apiKey", keyInput.trim());
			store.setCell("aiProviders", "openai", "status", "ready");
			store.setCell("aiProviders", "openai", "error", "");
		} catch (err) {
			const message = err instanceof Error ? err.message : "Validation failed";
			setValidationError(message);
		} finally {
			setIsValidating(false);
		}
	};

	const handleDone = () => {
		setActiveProvider("openai");
		router.back();
	};

	return (
		<View style={{ flex: 1 }}>
			<GradientBackground variant="simple" />
			<SafeAreaView style={{ flex: 1 }}>
				<View
					style={{
						width: "100%",
						justifyContent: "space-between",
						alignItems: "center",
						flexDirection: "row",
						padding: 16,
					}}
				>
					<Button onPress={() => router.back()} variant="ghost" size="icon">
						<ChevronLeft
							color="rgba(125,125,125,0.7)"
							strokeWidth={2}
							size={24}
						/>
					</Button>
					<ModeToggle />
				</View>

				<KeyboardAvoidingView
					behavior={Platform.OS === "ios" ? "padding" : undefined}
					style={{
						flex: 1,
						justifyContent: "center",
						alignItems: "center",
						paddingHorizontal: 24,
						maxWidth: 400,
						alignSelf: "center",
						width: "100%",
					}}
				>
					<Text
						variant="title"
						style={{ textAlign: "center", marginBottom: 16, fontSize: 32 }}
					>
						Connect OpenAI
					</Text>
					<Text
						variant="body"
						style={{
							textAlign: "center",
							lineHeight: 24,
							opacity: 0.8,
							marginBottom: 32,
						}}
					>
						Use GPT models directly from OpenAI. Your conversations are sent to
						OpenAI's servers.
					</Text>

					{!apiKey ? (
						<View style={{ gap: 16, width: "100%", paddingTop: 200 }}>
							<Input
								placeholder="sk-..."
								value={keyInput}
								onChangeText={setKeyInput}
								autoCapitalize="none"
								autoCorrect={false}
								secureTextEntry
								variant="outline"
								returnKeyType="done"
								onSubmitEditing={handleValidateAndSave}
							/>
							<Button
								onPress={handleValidateAndSave}
								disabled={isValidating || !keyInput.trim()}
								style={{ width: "100%" }}
							>
								{isValidating ? "Validating..." : "Validate & Save"}
							</Button>
							{(validationError || error) && (
								<Text
									style={{
										color: "#ef4444",
										fontSize: 14,
										textAlign: "center",
									}}
								>
									{validationError || error}
								</Text>
							)}
						</View>
					) : (
						<View style={{ gap: 16, width: "100%", paddingTop: 256 }}>
							<Text
								variant="body"
								style={{
									textAlign: "center",
									opacity: 0.8,
									maxWidth: 256,
									margin: "auto",
									paddingBottom: 24,
									fontWeight: "600",
									fontSize: 16,
								}}
							>
								You're connected to OpenAI
							</Text>
							<Button onPress={handleDone} style={{ width: "100%" }}>
								Done
							</Button>
						</View>
					)}
				</KeyboardAvoidingView>
			</SafeAreaView>
		</View>
	);
}
