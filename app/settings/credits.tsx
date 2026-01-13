import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { type AuthorCredit, CREDIT_SECTIONS } from "@/src/data/credits";
import generatedCredits from "@/src/data/generated-authors.json";
import { Colors } from "@/theme/colors";
import { BORDER_RADIUS } from "@/theme/globals";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ChevronLeft, ExternalLink } from "lucide-react-native";
import { TouchableOpacity, useColorScheme } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Credits() {
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];
	const router = useRouter();

	const creditsBySection = generatedCredits.creditsBySection;

	const handleOpenUrl = async (url: string) => {
		try {
			Haptics.selectionAsync();
			await WebBrowser.openBrowserAsync(url, {
				presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
				controlsColor: theme.primary,
			});
		} catch (error) {
			console.error("Failed to open URL:", error);
		}
	};

	return (
		<SafeAreaView
			style={{ flex: 1, backgroundColor: theme.background }}
			edges={["top", "left", "right"]}
		>
			{/* Header */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					padding: 16,
					borderBottomWidth: 1,
					borderBottomColor: "rgba(125,125,125,0.15)",
					position: "relative",
				}}
			>
				<Button onPress={() => router.back()} variant="ghost" size="icon">
					<ChevronLeft color={theme.textMuted} strokeWidth={2} size={24} />
				</Button>
				<Text
					style={{
						fontSize: 18,
						fontWeight: "600",
						position: "absolute",
						left: 0,
						right: 0,
						textAlign: "center",
					}}
					pointerEvents="none"
				>
					Open Source Credits
				</Text>
			</View>

			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingBottom: 32 }}
			>
				{/* Intro */}
				<View
					style={{
						paddingHorizontal: 32,
						paddingTop: 24,
						paddingBottom: 24,
					}}
				>
					<Text
						style={{
							fontSize: 15,
							opacity: 0.7,
							lineHeight: 22,
							textAlign: "center",
						}}
					>
						Whisper is built with gratitude on the shoulders of incredible open
						source projects.
					</Text>
				</View>

				{/* Credits by Section */}
				{CREDIT_SECTIONS.map((section) => {
					const credits = creditsBySection[section.key] || [];
					if (credits.length === 0) return null;

					return (
						<View key={section.key} style={{ marginBottom: 24 }}>
							<Text
								variant="label"
								style={{
									fontSize: 13,
									fontWeight: "600",
									opacity: 0.7,
									marginBottom: 12,
									paddingHorizontal: 24,
								}}
							>
								{section.title}
							</Text>

							<View style={{ paddingHorizontal: 24, gap: 12 }}>
								{credits.map((credit) => (
									<CreditCard
										key={credit.author}
										credit={credit}
										theme={theme}
										onOpenUrl={handleOpenUrl}
									/>
								))}
							</View>
						</View>
					);
				})}
			</ScrollView>
		</SafeAreaView>
	);
}

interface CreditCardProps {
	credit: AuthorCredit;
	theme: (typeof Colors)["light"];
	onOpenUrl: (url: string) => void;
}

function CreditCard({ credit, theme, onOpenUrl }: CreditCardProps) {
	const hasUrl = !!credit.url;

	const CardContent = (
		<View
			style={{
				backgroundColor: theme.card,
				borderRadius: BORDER_RADIUS / 2,
				padding: 16,
				gap: 8,
			}}
		>
			{/* Author Name & Link Icon */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
				}}
			>
				<Text style={{ fontSize: 17, fontWeight: "600" }}>{credit.author}</Text>
				{hasUrl && (
					<ExternalLink color={theme.blue} strokeWidth={2} size={18} />
				)}
			</View>

			{/* Description */}
			<Text
				style={{
					fontSize: 14,
					opacity: 0.7,
					lineHeight: 20,
				}}
			>
				{credit.description}
			</Text>

			{/* Package List */}
			{credit.packages.length > 0 && (
				<View
					style={{
						flexDirection: "row",
						flexWrap: "wrap",
						gap: 6,
						marginTop: 4,
					}}
				>
					{credit.packages.map((pkg) => (
						<View
							key={pkg}
							style={{
								backgroundColor: theme.muted,
								paddingHorizontal: 8,
								paddingVertical: 4,
								borderRadius: 6,
							}}
						>
							<Text
								style={{
									fontSize: 11,
									fontWeight: "500",
									opacity: 0.8,
								}}
							>
								{pkg}
							</Text>
						</View>
					))}
				</View>
			)}
		</View>
	);

	if (!hasUrl) {
		return CardContent;
	}

	return (
		<TouchableOpacity
			onPress={() => onOpenUrl(credit.url!)}
			activeOpacity={0.7}
		>
			{CardContent}
		</TouchableOpacity>
	);
}
