import { GradientBackground } from "@/components/gradient-background";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIProvider } from "@/contexts/AIProviderContext";
import {
	cancelPolling,
	openVerificationPage,
} from "@/src/ai-providers/openai/oauth";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Clipboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCell } from "tinybase/ui-react";

export function OpenAISetup() {
	const router = useRouter();
	const { providers, setActiveProvider } = useAIProvider();
	const provider = providers.find((p) => p.id === "openai");

	const [isConnecting, setIsConnecting] = useState(false);
	const [copied, setCopied] = useState(false);

	const error = useCell("aiProviders", "openai", "error") as
		| string
		| undefined;
	const status = useCell("aiProviders", "openai", "status") as
		| string
		| undefined;
	const modelCard = useCell("aiProviders", "openai", "modelCard") as
		| string
		| undefined;

	// Parse device code from modelCard (used during auth flow)
	let deviceCode = "";
	if (modelCard && status === "configuring") {
		try {
			const parsed = JSON.parse(modelCard) as { deviceCode?: string };
			deviceCode = parsed.deviceCode ?? "";
		} catch {
			// not device code data
		}
	}

	const handleConnect = async () => {
		if (!provider) return;
		setIsConnecting(true);
		setCopied(false);
		try {
			await provider.startOAuth?.();
		} catch (err) {
			console.error("[OpenAISetup] OAuth error:", err);
		} finally {
			setIsConnecting(false);
		}
	};

	const handleCancel = useCallback(() => {
		cancelPolling();
		setIsConnecting(false);
	}, []);

	const handleCopyCode = useCallback(() => {
		if (deviceCode) {
			Clipboard.setString(deviceCode);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	}, [deviceCode]);

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

				<View
					style={{
						flex: 1,
						justifyContent: "space-between",
						paddingHorizontal: 24,
						maxWidth: 400,
						alignSelf: "center",
						width: "100%",
					}}
				>
					<View
						style={{
							alignItems: "center",
							paddingTop: 64,
						}}
					>
						<Text
							variant="title"
							style={{ textAlign: "center", marginBottom: 16, fontSize: 32 }}
						>
							Connect ChatGPT
						</Text>
						<Text
							variant="body"
							style={{
								textAlign: "center",
								lineHeight: 24,
								opacity: 0.8,
							}}
						>
							Sign in with your ChatGPT Plus or Pro subscription.
							Your conversations are sent to OpenAI's servers.
						</Text>
					</View>

					{status === "ready" ? (
						<View style={{ gap: 16, width: "100%", paddingBottom: 48 }}>
							<Text
								variant="body"
								style={{
									textAlign: "center",
									opacity: 0.8,
									paddingBottom: 24,
									fontWeight: "600",
									fontSize: 16,
								}}
							>
								You're connected to ChatGPT
							</Text>
							<Button onPress={handleDone} style={{ width: "100%" }}>
								Done
							</Button>
						</View>
					) : isConnecting && deviceCode ? (
						<View style={{ gap: 16, width: "100%", paddingBottom: 48 }}>
							<Text
								variant="body"
								style={{
									textAlign: "center",
									opacity: 0.8,
									fontSize: 14,
								}}
							>
								Enter this code at auth.openai.com:
							</Text>
							<Text
								variant="title"
								style={{
									textAlign: "center",
									fontSize: 36,
									letterSpacing: 4,
									fontWeight: "700",
								}}
							>
								{deviceCode}
							</Text>
							<Button onPress={handleCopyCode} variant="outline">
								{copied ? "Copied!" : "Copy Code"}
							</Button>
							<Button onPress={openVerificationPage}>
								Open OpenAI
							</Button>
							<View
								style={{
									flexDirection: "row",
									alignItems: "center",
									justifyContent: "center",
									gap: 8,
									marginTop: 16,
								}}
							>
								<ActivityIndicator size="small" />
								<Text
									variant="body"
									style={{ opacity: 0.6, fontSize: 14 }}
								>
									Waiting for authorization...
								</Text>
							</View>
							<Button
								onPress={handleCancel}
								variant="ghost"
							>
								Cancel
							</Button>
						</View>
					) : (
						<View style={{ gap: 16, width: "100%", paddingBottom: 48 }}>
							<Button
								onPress={handleConnect}
								disabled={isConnecting}
								style={{ width: "100%" }}
							>
								{isConnecting
									? "Connecting..."
									: "Sign in with ChatGPT"}
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
					)}
				</View>
			</SafeAreaView>
		</View>
	);
}
