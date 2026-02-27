import { useAIProvider } from "@/contexts/AIProviderContext";
import { useColor } from "@/hooks/useColor";
import type { AIProvider, ProviderModel } from "@/src/ai-providers/types";
import type { AppIconVariant } from "@/src/data/app-icon-presets";
import { getAppIconPresetById } from "@/src/data/app-icon-presets";
import { Colors } from "@/theme/colors";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Check, ChevronDown, Search } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	TextInput,
	TouchableOpacity,
	useColorScheme,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useCell, useValue } from "tinybase/ui-react";
import { Text } from "./ui/text";
import { TopSheet } from "./ui/top-sheet";
import { View } from "./ui/view";

const TOP_MODEL_COUNT = 5;

function formatModelId(modelId: string): string {
	// "anthropic/claude-3.5-sonnet" → "claude-3.5-sonnet"
	const parts = modelId.split("/");
	return parts[parts.length - 1];
}

export function ProviderAndModelSelector() {
	const [open, setOpen] = useState(false);
	const { activeProvider, providers, setActiveProvider } = useAIProvider();
	const textMuted = useColor("textMuted");
	const primary = useColor("primary");
	const router = useRouter();

	const selectedModelId = useCell(
		"aiProviders",
		activeProvider?.id ?? "",
		"selectedModelId",
	) as string | undefined;

	const displayName = activeProvider?.name ?? "Select AI";
	const appIconVariant = useValue("app_icon_variant") as
		| AppIconVariant
		| undefined;
	const appIconPreset = getAppIconPresetById(appIconVariant || "Default");
	const avatarSource = activeProvider
		? activeProvider.id === "whisper-ai"
			? appIconPreset?.image
			: activeProvider.avatar
		: appIconPreset?.image;

	return (
		<>
			<TouchableOpacity
				onPress={() => setOpen(true)}
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 6,
					paddingHorizontal: 4,
					paddingVertical: 4,
				}}
				activeOpacity={0.7}
			>
				<Image
					source={avatarSource}
					style={{ width: 16, height: 16, borderRadius: 8 }}
				/>
				<View>
					<Text style={{ fontSize: 16, fontWeight: "600" }} numberOfLines={1}>
						{displayName}
					</Text>
					{selectedModelId ? (
						<Text style={{ fontSize: 11, color: textMuted }} numberOfLines={1}>
							{formatModelId(selectedModelId)}
						</Text>
					) : null}
				</View>
				<ChevronDown color={textMuted} size={14} strokeWidth={2} />
			</TouchableOpacity>

			<TopSheet isVisible={open} onClose={() => setOpen(false)}>
				<SelectAIContent
					open={open}
					providers={providers}
					activeProviderId={activeProvider?.id ?? null}
					onSelectLocal={(p) => {
						setActiveProvider(p.id);
						setOpen(false);
					}}
					onSelectCloudModel={(p, modelId) => {
						p.setModel(modelId);
						setActiveProvider(p.id);
						setOpen(false);
					}}
					onSetup={() => {
						setOpen(false);
						router.push("/setup-ai");
					}}
				/>
			</TopSheet>
		</>
	);
}

function SelectAIContent({
	open,
	providers,
	activeProviderId,
	onSelectLocal,
	onSelectCloudModel,
	onSetup,
}: {
	open: boolean;
	providers: AIProvider[];
	activeProviderId: string | null;
	onSelectLocal: (provider: AIProvider) => void;
	onSelectCloudModel: (provider: AIProvider, modelId: string) => void;
	onSetup: () => void;
}) {
	const [searchQuery, setSearchQuery] = useState("");
	const colorScheme = useColorScheme() ?? "light";
	const theme = Colors[colorScheme];

	useEffect(() => {
		if (!open) setSearchQuery("");
	}, [open]);

	const localProviders = providers.filter((p) => p.type === "local");
	const cloudProviders = providers.filter((p) => p.type === "cloud");
	const query = searchQuery.toLowerCase();

	// Sort active provider to top within each group
	const sortedLocal = [...localProviders].sort((a, b) => {
		if (a.id === activeProviderId) return -1;
		if (b.id === activeProviderId) return 1;
		return 0;
	});
	const sortedCloud = [...cloudProviders].sort((a, b) => {
		if (a.id === activeProviderId) return -1;
		if (b.id === activeProviderId) return 1;
		return 0;
	});

	// Render the group containing the active provider first
	const activeIsCloud = cloudProviders.some((p) => p.id === activeProviderId);

	const localSection = sortedLocal.map((p) => {
		const matchesSearch =
			!query ||
			p.name.toLowerCase().includes(query) ||
			p.description.toLowerCase().includes(query);
		if (!matchesSearch) return null;
		return (
			<LocalProviderItem
				key={p.id}
				provider={p}
				isActive={activeProviderId === p.id}
				theme={theme}
				onSelect={() => onSelectLocal(p)}
				onSetup={onSetup}
			/>
		);
	});

	const cloudSection = sortedCloud.map((p) => (
		<CloudProviderSection
			key={p.id}
			provider={p}
			activeProviderId={activeProviderId}
			theme={theme}
			searchQuery={query}
			open={open}
			onSelectModel={(modelId) => onSelectCloudModel(p, modelId)}
			onSetup={onSetup}
		/>
	));

	return (
		<ScrollView
			style={{ flex: 1 }}
			contentContainerStyle={{ padding: 20, paddingBottom: 8 }}
			keyboardShouldPersistTaps="handled"
		>
			<Text
				variant="title"
				style={{ fontSize: 22, textAlign: "center", marginBottom: 16 }}
			>
				Select AI
			</Text>

			{/* Search bar */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					backgroundColor: "rgba(125,125,125,0.1)",
					borderRadius: 10,
					paddingHorizontal: 12,
					marginBottom: 16,
					gap: 8,
				}}
			>
				<Search color={theme.textMuted} size={16} strokeWidth={2} />
				<TextInput
					value={searchQuery}
					onChangeText={setSearchQuery}
					placeholder="Search for AI providers and models..."
					placeholderTextColor={theme.textMuted}
					style={{
						flex: 1,
						paddingVertical: 10,
						fontSize: 14,
						color: theme.text,
					}}
					autoCapitalize="none"
					autoCorrect={false}
				/>
			</View>

			{activeIsCloud ? (
				<>
					{cloudSection}
					{localSection}
				</>
			) : (
				<>
					{localSection}
					{cloudSection}
				</>
			)}
		</ScrollView>
	);
}

function LocalProviderItem({
	provider,
	isActive,
	theme,
	onSelect,
	onSetup,
}: {
	provider: AIProvider;
	isActive: boolean;
	theme: (typeof Colors)["light"];
	onSelect: () => void;
	onSetup: () => void;
}) {
	const status = useCell("aiProviders", provider.id, "status") as
		| string
		| undefined;
	const canActivate = provider.isConfigured() || status === "ready";
	const appIconVariant = useValue("app_icon_variant") as
		| AppIconVariant
		| undefined;
	const appIconPreset = getAppIconPresetById(appIconVariant || "Default");
	const avatarSource =
		provider.id === "whisper-ai" ? appIconPreset?.image : provider.avatar;

	return (
		<TouchableOpacity
			onPress={canActivate ? onSelect : onSetup}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 12,
				paddingVertical: 14,
				paddingHorizontal: isActive ? 14 : 0,
				borderRadius: 12,
				backgroundColor: isActive ? "rgba(125,125,125,0.1)" : "transparent",
				marginBottom: 4,
			}}
			activeOpacity={0.7}
		>
			<Image
				source={avatarSource}
				style={{ width: 22, height: 22, borderRadius: 11 }}
			/>
			<View style={{ flex: 1 }}>
				<Text style={{ fontWeight: "600", fontSize: 15 }}>{provider.name}</Text>
				<Text
					style={{
						fontSize: 12,
						color: theme.textMuted,
						marginTop: 2,
					}}
				>
					{provider.description}
				</Text>
			</View>
			{isActive && (
				<View
					style={{
						width: 20,
						height: 20,
						borderRadius: 10,
						backgroundColor: theme.green,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Check color="#FFFFFF" size={12} strokeWidth={3} />
				</View>
			)}
		</TouchableOpacity>
	);
}

function CloudProviderSection({
	provider,
	activeProviderId,
	theme,
	searchQuery,
	open,
	onSelectModel,
	onSetup,
}: {
	provider: AIProvider;
	activeProviderId: string | null;
	theme: (typeof Colors)["light"];
	searchQuery: string;
	open: boolean;
	onSelectModel: (modelId: string) => void;
	onSetup: () => void;
}) {
	const status = useCell("aiProviders", provider.id, "status") as
		| string
		| undefined;
	const selectedModelId = useCell(
		"aiProviders",
		provider.id,
		"selectedModelId",
	) as string | undefined;
	const [models, setModels] = useState<ProviderModel[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const isReady = status === "ready";
	const isActiveProvider = activeProviderId === provider.id;
	const isSearching = searchQuery.length > 0;

	// Fetch models when sheet opens and provider is ready
	useEffect(() => {
		if (!open || !isReady) return;
		setIsLoading(true);
		provider
			.models()
			.then(setModels)
			.catch(console.error)
			.finally(() => setIsLoading(false));
	}, [open, provider, isReady]);

	const displayModels = (() => {
		if (isSearching) {
			return models.filter(
				(m) =>
					m.name.toLowerCase().includes(searchQuery) ||
					m.id.toLowerCase().includes(searchQuery),
			);
		}
		// Ensure the selected model is always visible at the top
		if (isActiveProvider && selectedModelId) {
			const selected = models.find((m) => m.id === selectedModelId);
			const rest = models
				.filter((m) => m.id !== selectedModelId)
				.slice(0, TOP_MODEL_COUNT - 1);
			return selected ? [selected, ...rest] : models.slice(0, TOP_MODEL_COUNT);
		}
		return models.slice(0, TOP_MODEL_COUNT);
	})();

	// Hide section entirely if searching and nothing matches
	if (
		isSearching &&
		displayModels.length === 0 &&
		!provider.name.toLowerCase().includes(searchQuery)
	) {
		return null;
	}

	return (
		<View style={{ marginTop: 20 }}>
			{/* Section header */}
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					gap: 8,
					marginBottom: 12,
					paddingHorizontal: 4,
				}}
			>
				<Image
					source={provider.avatar}
					style={{ width: 18, height: 18, borderRadius: 9 }}
				/>
				<Text
					style={{
						fontSize: 12,
						fontWeight: "600",
						color: theme.textMuted,
						letterSpacing: 1,
					}}
				>
					{provider.name.toUpperCase()}
				</Text>
			</View>

			{!isReady ? (
				<TouchableOpacity
					onPress={onSetup}
					activeOpacity={0.7}
					style={{ paddingVertical: 12, paddingLeft: 30 }}
				>
					<Text
						style={{
							fontSize: 14,
							color: theme.blue,
							fontWeight: "500",
						}}
					>
						Set up {provider.name} to browse models
					</Text>
				</TouchableOpacity>
			) : isLoading ? (
				<View style={{ paddingVertical: 20, alignItems: "center" }}>
					<ActivityIndicator />
				</View>
			) : (
				<>
					{displayModels.map((model) => {
						const isSelected = isActiveProvider && selectedModelId === model.id;
						return (
							<TouchableOpacity
								key={model.id}
								onPress={() => onSelectModel(model.id)}
								style={{
									flexDirection: "row",
									alignItems: "center",
									paddingVertical: 12,
									paddingLeft: 30,
								}}
								activeOpacity={0.7}
							>
								<Text
									style={{
										flex: 1,
										fontSize: 15,
										fontWeight: isSelected ? "600" : "400",
										color: isSelected ? theme.green : "inherit",
									}}
									numberOfLines={1}
								>
									{model.name}
								</Text>
								{isSelected && (
									<View
										style={{
											width: 24,
											height: 24,
											borderRadius: 24,
											backgroundColor: theme.green,
											alignItems: "center",
											justifyContent: "center",
											marginLeft: 8,
										}}
									>
										<Check color="#FFFFFF" size={12} strokeWidth={3} />
									</View>
								)}
							</TouchableOpacity>
						);
					})}
					{isSearching && displayModels.length === 0 && (
						<Text
							style={{
								fontSize: 13,
								opacity: 0.5,
								paddingVertical: 12,
								paddingLeft: 30,
							}}
						>
							No models found
						</Text>
					)}
				</>
			)}
		</View>
	);
}
