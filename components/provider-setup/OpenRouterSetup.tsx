import { GradientBackground } from "@/components/gradient-background";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCell } from "tinybase/ui-react";

export function OpenRouterSetup() {
	const router = useRouter();
	const { providers, setActiveProvider } = useAIProvider();
	const provider = providers.find((p) => p.id === "openrouter");

	const [isConnecting, setIsConnecting] = useState(false);

	const error = useCell("aiProviders", "openrouter", "error") as
		| string
		| undefined;
	const apiKey = useCell("aiProviders", "openrouter", "apiKey") as
		| string
		| undefined;

	const handleConnect = async () => {
		if (!provider) return;
		setIsConnecting(true);
		try {
			await provider.startOAuth?.();
		} catch (err) {
			console.error("[OpenRouterSetup] OAuth error:", err);
		} finally {
			setIsConnecting(false);
		}
	};

	const handleDone = () => {
		setActiveProvider("openrouter");
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
						Connect OpenRouter
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
						Access hundreds of AI models through OpenRouter. Your conversations
						are sent to cloud providers.
					</Text>

					{!apiKey ? (
						<View style={{ gap: 16, width: "100%", paddingTop: 256 }}>
							<Button
								onPress={handleConnect}
								disabled={isConnecting}
								style={{ width: "100%" }}
							>
								{isConnecting ? "Connecting..." : "Connect with OpenRouter"}
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
								You're connected to OpenRouter
							</Text>
							<Button onPress={handleDone} style={{ width: "100%" }}>
								Done
							</Button>
						</View>
					)}
				</View>
			</SafeAreaView>
		</View>
	);
}
