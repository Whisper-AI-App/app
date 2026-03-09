import { GradientBackground } from "@/components/gradient-background";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { useColor } from "@/hooks/useColor";
import { getCredential, setCredential } from "@/src/actions/secure-credentials";
import { Colors } from "@/theme/colors";
import { useRouter } from "expo-router";
import { fetch as expoFetch } from "expo/fetch";
import { ChevronDown, ChevronLeft } from "lucide-react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	type TextInput,
	TouchableOpacity,
	useColorScheme,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCell, useStore } from "tinybase/ui-react";

const PRESET_ENDPOINTS = [
	{
		label: "Google Gemini",
		protocol: "openai",
		url: "https://generativelanguage.googleapis.com/v1beta",
	},
	{
		label: "OpenRouter",
		protocol: "openai",
		url: "https://openrouter.ai/api/v1",
	},
	{ label: "OpenAI", protocol: "openai", url: "https://api.openai.com/v1" },
	{
		label: "Anthropic Claude",
		protocol: "anthropic",
		url: "https://api.anthropic.com/v1",
	},
	{ label: "Mistral AI", protocol: "openai", url: "https://api.mistral.ai/v1" },
	{ label: "Z.ai", protocol: "openai", url: "https://api.z.ai/api/paas/v4/" },
	{
		label: "GitHub Models",
		protocol: "openai",
		url: "https://models.github.ai/inference",
	},
	{
		label: "Moonshot AI",
		protocol: "openai",
		url: "https://api.moonshot.ai/v1",
	},
	{
		label: "MiniMax",
		protocol: "anthropic",
		url: "https://api.minimax.io/anthropic/v1",
	},
	{ label: "Poe", protocol: "openai", url: "https://api.poe.com/v1" },
] as const;

type CheckStatus = "checking" | "success" | "error";

export function CustomProviderSetup() {
	const router = useRouter();
	const store = useStore();
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const background = useColor("background");
	const { setActiveProvider } = useAIProvider();

	const apiKeyRef = useRef<TextInput>(null);
	const [endpointInput, setEndpointInput] = useState("");
	const [keyInput, setKeyInput] = useState("");
	const [protocolInput, setProtocolInput] = useState<"openai" | "anthropic">(
		"openai",
	);
	const [showProtocolDropdown, setShowProtocolDropdown] = useState(false);
	const textMuted = useColor("textMuted");
	const cardColor = useColor("card");
	const green = useColor("green");
	const red = useColor("red");

	// Get presets based on protocol
	const currentPresets = PRESET_ENDPOINTS.filter(
		(p) => p.protocol === protocolInput,
	);

	// Handle protocol change - clear endpoint when switching
	const handleProtocolChange = (newProtocol: "openai" | "anthropic") => {
		setProtocolInput(newProtocol);
		setEndpointInput("");
		setShowProtocolDropdown(false);
	};

	// Status checks
	const [endpointStatus, setEndpointStatus] = useState<CheckStatus | null>(
		null,
	);
	const [modelsStatus, setModelsStatus] = useState<CheckStatus | null>(null);
	const [modelCount, setModelCount] = useState(0);

	const error = useCell("aiProviders", "custom-provider", "error") as string | undefined;
	const status = useCell("aiProviders", "custom-provider", "status") as
		| string
		| undefined;
	const endpointUrl = useCell("aiProviders", "custom-provider", "endpointUrl") as
		| string
		| undefined;
	const protocol = useCell("aiProviders", "custom-provider", "protocol") as
		| "openai"
		| "anthropic"
		| undefined;

	// Set initial protocol from store
	useEffect(() => {
		if (protocol) {
			setProtocolInput(protocol);
		}
	}, [protocol]);

	const runStatusChecks = useCallback(async () => {
		if (status !== "ready" || !endpointUrl) return;

		const storedKey = await getCredential("custom-provider", "apiKey");
		if (!storedKey) return;

		const baseUrl = endpointUrl.replace(/\/+$/, "");

		// Check endpoint reachability
		setEndpointStatus("checking");
		setModelsStatus("checking");
		try {
			const response = await expoFetch(`${baseUrl}/models`, {
				headers: { Authorization: `Bearer ${storedKey}` },
			});
			if (response.ok) {
				setEndpointStatus("success");
				// Check models
				try {
					const data = (await response.json()) as {
						data?: Array<{ id: string }>;
					};
					const count = data?.data?.length ?? 0;
					setModelCount(count);
					setModelsStatus(count > 0 ? "success" : "error");
				} catch {
					setModelsStatus("error");
				}
			} else {
				// Endpoint responded but with an error — still reachable
				setEndpointStatus("success");
				setModelsStatus("error");
			}
		} catch {
			setEndpointStatus("error");
			setModelsStatus("error");
		}
	}, [status, endpointUrl]);

	useEffect(() => {
		runStatusChecks();
	}, [runStatusChecks]);

	const handleSave = async () => {
		if (!endpointInput.trim() || !keyInput.trim() || !store) return;

		const baseUrl = endpointInput.trim().replace(/\/+$/, "");

		// Store API key in secure storage instead of TinyBase
		await setCredential("custom-provider", "apiKey", keyInput.trim());

		store.setCell("aiProviders", "custom-provider", "endpointUrl", baseUrl);
		store.setCell("aiProviders", "custom-provider", "protocol", protocolInput);
		store.setCell("aiProviders", "custom-provider", "status", "ready");
		store.setCell("aiProviders", "custom-provider", "error", "");
	};

	const handleDone = () => {
		setActiveProvider("custom-provider");
		router.back();
	};

	const statusColor = (s: CheckStatus | null) => {
		if (s === "success") return green;
		if (s === "error") return red;
		return textMuted;
	};

	const statusIcon = (s: CheckStatus | null) => {
		if (s === "checking") return "...";
		if (s === "success") return "\u2713";
		if (s === "error") return "\u2717";
		return "";
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
					keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
					style={{ flex: 1 }}
				>
					<Pressable
						onPress={Keyboard.dismiss}
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
							Custom Provider
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
							Connect to any Anthropic or OpenAI-compatible API provider.
						</Text>

						{status !== "ready" ? (
							<View style={{ gap: 16, width: "100%", paddingTop: 48 }}>
								{/* Protocol dropdown */}
								<View>
									<Text
										style={{ fontSize: 14, marginBottom: 8, color: textMuted }}
									>
										Protocol
									</Text>
									<TouchableOpacity
										onPress={() =>
											setShowProtocolDropdown(!showProtocolDropdown)
										}
										style={{
											flexDirection: "row",
											alignItems: "center",
											justifyContent: "space-between",
											paddingVertical: 14,
											paddingHorizontal: 12,
											backgroundColor: cardColor,
											borderRadius: 8,
											borderWidth: 1,
											borderColor: "rgba(125,125,125,0.2)",
										}}
										activeOpacity={0.7}
									>
										<Text style={{ fontSize: 16, color: theme.text }}>
											{protocolInput === "openai"
												? "OpenAI Compatible"
												: "Anthropic Compatible"}
										</Text>
										<ChevronDown color={textMuted} size={20} />
									</TouchableOpacity>
									{showProtocolDropdown && (
										<View
											style={{
												position: "absolute",
												top: 60,
												left: 0,
												right: 0,
												backgroundColor: cardColor,
												borderRadius: 8,
												borderWidth: 1,
												borderColor: "rgba(125,125,125,0.2)",
												zIndex: 100,
												overflow: "hidden",
											}}
										>
											<TouchableOpacity
												onPress={() => handleProtocolChange("openai")}
												style={{
													paddingVertical: 14,
													paddingHorizontal: 12,
													borderBottomWidth: 1,
													borderBottomColor: "rgba(125,125,125,0.1)",
												}}
												activeOpacity={0.7}
											>
												<Text style={{ fontSize: 16, color: theme.text }}>
													OpenAI Compatible
												</Text>
											</TouchableOpacity>
											<TouchableOpacity
												onPress={() => handleProtocolChange("anthropic")}
												style={{
													paddingVertical: 14,
													paddingHorizontal: 12,
												}}
												activeOpacity={0.7}
											>
												<Text style={{ fontSize: 16, color: theme.text }}>
													Anthropic Compatible
												</Text>
											</TouchableOpacity>
										</View>
									)}
								</View>

								<View>
									<Input
										placeholder="https://api.example.com/v1"
										value={endpointInput}
										onChangeText={setEndpointInput}
										onSubmitEditing={() => apiKeyRef.current?.focus()}
										autoCapitalize="none"
										autoCorrect={false}
										keyboardType="url"
										variant="outline"
										returnKeyType="next"
										blurOnSubmit={false}
									/>
									<ScrollView
										horizontal
										showsHorizontalScrollIndicator={false}
										keyboardShouldPersistTaps="handled"
										style={{ marginHorizontal: -24 }}
										contentContainerStyle={{
											gap: 8,
											paddingTop: 10,
											paddingBottom: 2,
											paddingHorizontal: 24,
										}}
									>
										{currentPresets.map((preset) => (
											<TouchableOpacity
												key={preset.label}
												onPress={() =>
													preset.url && setEndpointInput(preset.url)
												}
												style={{
													backgroundColor: cardColor,
													borderRadius: 16,
													paddingHorizontal: 12,
													paddingVertical: 6,
													borderWidth: 1,
													borderColor: "rgba(125,125,125,0.2)",
													opacity: preset.url ? 1 : 0.5,
												}}
												activeOpacity={preset.url ? 0.7 : 1}
												disabled={!preset.url}
											>
												<Text style={{ fontSize: 13, fontWeight: "500" }}>
													{preset.label}
												</Text>
												{preset.url ? (
													<Text
														style={{
															fontSize: 10,
															color: textMuted,
															marginTop: 1,
														}}
														numberOfLines={1}
													>
														{preset.url}
													</Text>
												) : null}
											</TouchableOpacity>
										))}
									</ScrollView>
								</View>
								<Input
									ref={apiKeyRef}
									placeholder="API key"
									value={keyInput}
									onChangeText={setKeyInput}
									autoCapitalize="none"
									autoCorrect={false}
									secureTextEntry
									variant="outline"
									returnKeyType="done"
								/>
								<Button
									onPress={handleSave}
									disabled={!keyInput.trim() || !endpointInput.trim()}
									style={{ width: "100%" }}
								>
									Save
								</Button>
								{error && (
									<Text
										style={{
											color: "#ef4444",
											fontSize: 14,
											textAlign: "center",
										}}
									>
										{error}
									</Text>
								)}
							</View>
						) : (
							<View style={{ gap: 16, width: "100%", paddingTop: 48 }}>
								{/* Status checks */}
								<View style={{ gap: 10, paddingBottom: 8 }}>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 8,
											backgroundColor: background,
											paddingVertical: 4,
											paddingHorizontal: 12,
											borderRadius: 12,
										}}
									>
										<Text
											style={{
												fontSize: 16,
												color: statusColor(endpointStatus),
												fontWeight: "600",
											}}
										>
											{statusIcon(endpointStatus)}
										</Text>
										<Text
											style={{
												fontSize: 14,
												color: statusColor(endpointStatus),
											}}
										>
											{endpointStatus === "checking"
												? "Checking endpoint..."
												: endpointStatus === "success"
													? "Endpoint reachable"
													: endpointStatus === "error"
														? "Endpoint unreachable"
														: ""}
										</Text>
									</View>
									<View
										style={{
											flexDirection: "row",
											alignItems: "center",
											gap: 8,
											backgroundColor: background,
											paddingVertical: 4,
											paddingHorizontal: 12,
											borderRadius: 12,
										}}
									>
										<Text
											style={{
												fontSize: 16,
												color: statusColor(modelsStatus),
												fontWeight: "600",
											}}
										>
											{statusIcon(modelsStatus)}
										</Text>
										<Text
											style={{ fontSize: 14, color: statusColor(modelsStatus) }}
										>
											{modelsStatus === "checking"
												? "Checking models..."
												: modelsStatus === "success"
													? `${modelCount} model${modelCount !== 1 ? "s" : ""} available`
													: modelsStatus === "error"
														? "Models unavailable (you can enter model IDs manually)"
														: ""}
										</Text>
									</View>
								</View>

								<Button onPress={handleDone} style={{ width: "100%" }}>
									Done
								</Button>
							</View>
						)}
					</Pressable>
				</KeyboardAvoidingView>
			</SafeAreaView>
		</View>
	);
}
