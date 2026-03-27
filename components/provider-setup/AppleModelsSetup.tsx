import { GradientBackground } from "@/components/gradient-background";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { useColor } from "@/hooks/useColor";
import { useRouter } from "expo-router";
import { ChevronLeft, Check, Info } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCell } from "tinybase/ui-react";
import type { ProviderModel } from "@/src/ai-providers/types";

function useAppleIntelligenceAvailable(): boolean {
	try {
		const { apple } = require("@react-native-ai/apple");
		return apple.isAvailable();
	} catch {
		return false;
	}
}

export function AppleModelsSetup() {
	const router = useRouter();
	const { providers, setActiveProvider } = useAIProvider();
	const provider = providers.find((p) => p.id === "apple-models");
	const primaryColor = useColor("primary");
	const primaryForegroundColor = useColor("primaryForeground");
	const mutedForegroundColor = useColor("mutedForeground");
	const isAvailable = useAppleIntelligenceAvailable();

	const [models, setModels] = useState<ProviderModel[]>([]);
	const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
	const [isSettingUp, setIsSettingUp] = useState(false);

	const error = useCell("aiProviders", "apple-models", "error") as
		| string
		| undefined;
	const status = useCell("aiProviders", "apple-models", "status") as
		| string
		| undefined;

	useEffect(() => {
		if (provider && isAvailable) {
			provider.models().then(setModels);
		}
	}, [provider, isAvailable]);

	const handleSelectModel = async () => {
		if (!provider || !selectedModelId) return;
		setIsSettingUp(true);

		try {
			provider.setModel(selectedModelId);
			await provider.setup();

			if (provider.isConfigured()) {
				await setActiveProvider("apple-models");
				router.back();
			}
		} catch (err) {
			console.error("[AppleModelsSetup] Setup error:", err);
		} finally {
			setIsSettingUp(false);
		}
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
						Apple Intelligence
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
						On-device Apple AI. No internet or downloads needed.
					</Text>

					{!isAvailable ? (
						<Card style={{ width: "100%", gap: 12, alignItems: "center" }}>
							<Info color={mutedForegroundColor} size={32} strokeWidth={1.5} />
							<Text
								style={{
									fontWeight: "600",
									fontSize: 16,
									textAlign: "center",
								}}
							>
								Not Available on This Device
							</Text>
							<Text
								style={{
									fontSize: 14,
									color: mutedForegroundColor,
									textAlign: "center",
									lineHeight: 20,
								}}
							>
								Apple Intelligence requires iOS 26 or later with Apple
								Intelligence enabled.
							</Text>
							<Text
								style={{
									fontSize: 14,
									color: mutedForegroundColor,
									textAlign: "center",
									lineHeight: 20,
								}}
							>
								Go to Settings &gt; Apple Intelligence &amp; Siri to check
								compatibility and enable it.
							</Text>
						</Card>
					) : (
						<View style={{ width: "100%", gap: 12 }}>
							{models.map((model) => {
								const isSelected = selectedModelId === model.id;
								return (
									<Pressable
										key={model.id}
										onPress={() => setSelectedModelId(model.id)}
									>
										<Card
											style={{
												borderWidth: 2,
												borderColor: isSelected
													? primaryColor
													: "transparent",
											}}
										>
											<View
												style={{
													flexDirection: "row",
													justifyContent: "space-between",
													alignItems: "center",
												}}
											>
												<View style={{ flex: 1 }}>
													<Text
														style={{ fontWeight: "600", fontSize: 16 }}
													>
														{model.name}
													</Text>
													{model.description && (
														<Text
															style={{
																fontSize: 13,
																color: mutedForegroundColor,
																marginTop: 4,
															}}
														>
															{model.description}
														</Text>
													)}
													{model.contextLength && (
														<Text
															style={{
																fontSize: 12,
																color: mutedForegroundColor,
																marginTop: 4,
															}}
														>
															Context: {model.contextLength.toLocaleString()}{" "}
															tokens
														</Text>
													)}
													<Text
														style={{
															fontSize: 12,
															color: mutedForegroundColor,
															marginTop: 2,
														}}
													>
														Text generation
													</Text>
												</View>
												{isSelected && (
													<Check
														color={primaryColor}
														size={20}
														strokeWidth={2.5}
													/>
												)}
											</View>
										</Card>
									</Pressable>
								);
							})}
						</View>
					)}
				</View>

				<View
					style={{
						width: "100%",
						paddingHorizontal: 24,
						paddingBottom: 40,
						gap: 12,
					}}
				>
					{error && status === "error" && (
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

					{isAvailable && (
						<Button
							onPress={handleSelectModel}
							disabled={!selectedModelId || isSettingUp}
							style={{ width: "100%" }}
						>
							{isSettingUp ? (
								<View
									style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
								>
									<ActivityIndicator color={primaryForegroundColor} />
									<Text style={{ color: primaryForegroundColor }}>
										Setting up...
									</Text>
								</View>
							) : (
								"Select Model"
							)}
						</Button>
					)}
				</View>
			</SafeAreaView>
		</View>
	);
}
