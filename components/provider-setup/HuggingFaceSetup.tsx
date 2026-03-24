import {
	HFModelCard,
	type ModelCardAction,
} from "@/components/provider-setup/HFModelCard";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { useAIProvider } from "@/contexts/AIProviderContext";
import { useColor } from "@/hooks/useColor";
import { getCredential, setCredential } from "@/src/actions/secure-credentials";
import {
	detectMmprojFile,
	getModelInfo,
	listFiles,
	searchModels,
} from "@/src/ai-providers/huggingface/api";
import { removeFromDownloadQueue } from "@/src/ai-providers/huggingface/download";
import { FEATURED_MODELS } from "@/src/ai-providers/huggingface/featured-models";
import { getPerformanceBadge } from "@/src/ai-providers/huggingface/performance-badge";
import type {
	FeaturedModel,
	PerformanceTier,
} from "@/src/ai-providers/huggingface/types";
import { mainStore } from "@/src/stores/main/main-store";
import * as Device from "expo-device";
import { getFreeDiskStorageAsync } from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import {
	ChevronDown,
	ChevronLeft,
	ChevronUp,
	Search,
	WifiOff,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Linking,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Store } from "tinybase";
import { useCell, useRowIds } from "tinybase/ui-react";

interface DisplayModel {
	id: string; // hfModels row ID format: repoId__filename
	repoId: string;
	filename: string;
	displayName: string;
	description: string;
	fileSizeBytes: number;
	quantization: string;
	pipelineTag: string;
	performanceTier: PerformanceTier;
	sha256: string;
	downloadUrl: string;
	parametersB: number;
	mmprojFilename?: string;
	mmprojSizeBytes?: number;
	mmprojDownloadUrl?: string;
	contextLength?: number;
}

function featuredToDisplay(model: FeaturedModel): DisplayModel {
	const deviceRAM = Device.totalMemory ?? 4 * 1024 * 1024 * 1024;
	return {
		id: `${model.repoId}__${model.filename}`,
		repoId: model.repoId,
		filename: model.filename,
		displayName: model.displayName,
		description: model.description,
		fileSizeBytes: model.fileSizeBytes,
		quantization: model.quantization,
		pipelineTag: model.pipelineTag,
		performanceTier: getPerformanceBadge(deviceRAM, model.fileSizeBytes),
		sha256: model.sha256,
		downloadUrl: model.downloadUrl,
		parametersB: model.parametersB,
		mmprojFilename: model.mmprojFilename,
		mmprojSizeBytes: model.mmprojSizeBytes,
		mmprojDownloadUrl: model.mmprojDownloadUrl,
		contextLength: model.contextLength,
	};
}

function sanitizeFilename(repoId: string, filename: string): string {
	const sanitized = `hf-${repoId.replace(/\//g, "-")}-${filename}`
		.replace(/[^a-zA-Z0-9._-]/g, "-")
		.substring(0, 100);
	return sanitized;
}

function formatRelativeDate(dateStr: string): string {
	if (!dateStr) return "";
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "Downloaded today";
	if (diffDays === 1) return "Downloaded yesterday";
	if (diffDays < 30) return `Downloaded ${diffDays} days ago`;
	if (diffDays < 365) {
		const months = Math.floor(diffDays / 30);
		return `Downloaded ${months} ${months === 1 ? "month" : "months"} ago`;
	}
	return `Downloaded on ${date.toLocaleDateString()}`;
}

function formatBytesGB(bytes: number): string {
	return (bytes / (1024 * 1024 * 1024)).toFixed(1);
}

export function HuggingFaceSetup({
	initialSearch,
}: {
	initialSearch?: string;
} = {}) {
	const router = useRouter();
	const { setActiveProvider } = useAIProvider();
	const borderColor = useColor("border");
	const mutedForeground = useColor("mutedForeground");
	const foreground = useColor("foreground");
	const store = mainStore as unknown as Store;

	const [searchQuery, setSearchQuery] = useState(initialSearch ?? "");
	const [searchResults, setSearchResults] = useState<DisplayModel[]>([]);
	const [isSearching, setIsSearching] = useState(false);
	const [activeMainTab, setActiveMainTab] = useState<"search" | "downloaded">(
		"search",
	);
	const [activeFilter, setActiveFilter] = useState<
		"all" | "text-generation" | "image-text-to-text"
	>("all");
	const [sortOption, setSortOption] = useState<"size-asc" | "size-desc">(
		"size-asc",
	);
	const [error, setError] = useState<string | undefined>();
	const [rateLimitRetryAt, setRateLimitRetryAt] = useState<number | null>(null);
	const [rateLimitCountdown, setRateLimitCountdown] = useState(0);
	const [isOffline, setIsOffline] = useState(false);
	const [freeDiskSpace, setFreeDiskSpace] = useState<number | null>(null);
	const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

	// Advanced section state
	const [advancedExpanded, setAdvancedExpanded] = useState(false);
	const [hfToken, setHfToken] = useState("");
	const [isTokenLoaded, setIsTokenLoaded] = useState(false);
	const tokenSaveTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

	// Check available disk space
	useEffect(() => {
		getFreeDiskStorageAsync()
			.then((bytes) => setFreeDiskSpace(bytes))
			.catch(() => {});
	}, []);

	// Rate limit countdown timer
	useEffect(() => {
		if (!rateLimitRetryAt) {
			setRateLimitCountdown(0);
			return;
		}
		const tick = () => {
			const remaining = Math.max(
				0,
				Math.ceil((rateLimitRetryAt - Date.now()) / 1000),
			);
			setRateLimitCountdown(remaining);
			if (remaining <= 0) {
				setRateLimitRetryAt(null);
				setError(undefined);
			}
		};
		tick();
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	}, [rateLimitRetryAt]);

	// Load HF token on mount
	useEffect(() => {
		getCredential("huggingface", "apiToken")
			.then((token) => {
				if (token) setHfToken(token);
				setIsTokenLoaded(true);
			})
			.catch(() => {
				setIsTokenLoaded(true);
			});
	}, []);

	// Debounced save of HF token
	useEffect(() => {
		if (!isTokenLoaded) return;
		if (tokenSaveTimeoutRef.current) clearTimeout(tokenSaveTimeoutRef.current);
		tokenSaveTimeoutRef.current = setTimeout(() => {
			if (hfToken.trim()) {
				setCredential("huggingface", "apiToken", hfToken.trim());
			}
		}, 800);
		return () => {
			if (tokenSaveTimeoutRef.current)
				clearTimeout(tokenSaveTimeoutRef.current);
		};
	}, [hfToken, isTokenLoaded]);

	// Subscribe to provider state
	const providerStatus = useCell("aiProviders", "huggingface", "status") as
		| string
		| undefined;
	const selectedModelId = useCell(
		"aiProviders",
		"huggingface",
		"selectedModelId",
	) as string | undefined;
	const progressSizeGB = useCell(
		"aiProviders",
		"huggingface",
		"progressSizeGB",
	) as number | undefined;
	const totalSizeGB = useCell("aiProviders", "huggingface", "totalSizeGB") as
		| number
		| undefined;
	const isPaused = useCell("aiProviders", "huggingface", "isPaused") as
		| boolean
		| undefined;
	const downloadError = useCell(
		"aiProviders",
		"huggingface",
		"downloadError",
	) as string | undefined;
	const downloadQueueStr = useCell(
		"aiProviders",
		"huggingface",
		"downloadQueue",
	) as string | undefined;

	// Parse download queue
	const downloadQueue = useMemo(() => {
		if (!downloadQueueStr) return [];
		try {
			const parsed = JSON.parse(downloadQueueStr);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}, [downloadQueueStr]);

	// Auto-select HuggingFace as active provider when download completes
	const prevStatusRef = useRef(providerStatus);
	useEffect(() => {
		if (prevStatusRef.current === "downloading" && providerStatus === "ready") {
			setActiveProvider("huggingface");
		}
		prevStatusRef.current = providerStatus;
	}, [providerStatus, setActiveProvider]);

	// Subscribed to hfModels table for downloaded models
	const downloadedModelIds = useRowIds("hfModels");

	const downloadedModels = useMemo(() => {
		return downloadedModelIds
			.map((id) => {
				const row = store.getRow("hfModels", id);
				return {
					id,
					displayName: (row?.displayName as string) || id,
					fileSizeBytes: (row?.fileSizeBytes as number) || 0,
					quantization: (row?.quantization as string) || "",
					pipelineTag: (row?.pipelineTag as string) || "",
					downloadedAt: (row?.downloadedAt as string) || "",
				};
			})
			.filter((m) => m.downloadedAt);
	}, [downloadedModelIds, store]);

	const featuredModels = useMemo(
		() => FEATURED_MODELS.map(featuredToDisplay),
		[],
	);

	const isDownloading = providerStatus === "downloading" && !isPaused;
	const downloadProgress =
		totalSizeGB && progressSizeGB ? progressSizeGB / totalSizeGB : 0;

	// Debounced search with offline detection
	useEffect(() => {
		if (!searchQuery.trim()) {
			setSearchResults([]);
			setIsSearching(false);
			return;
		}

		if (isOffline) {
			// Don't attempt search while offline
			setIsSearching(false);
			return;
		}

		setIsSearching(true);
		if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

		searchTimeoutRef.current = setTimeout(async () => {
			try {
				const results = await searchModels(searchQuery.trim());
				const deviceRAM = Device.totalMemory ?? 4 * 1024 * 1024 * 1024;

				// For search results, we need file info to show sizes
				const displayResults: DisplayModel[] = [];
				for (const result of results.slice(0, 10)) {
					try {
						const files = await listFiles(result.repoId);

						// Detect mmproj for vision models
						let mmprojInfo: {
							filename: string;
							sizeBytes: number;
							downloadUrl: string;
						} | null = null;
						if (result.pipelineTag === "image-text-to-text") {
							try {
								mmprojInfo = await detectMmprojFile(result.repoId);
							} catch {
								// mmproj detection failure is non-fatal
							}
						}

						for (const file of files) {
							displayResults.push({
								id: `${result.repoId}__${file.filename}`,
								repoId: result.repoId,
								filename: file.filename,
								displayName: result.repoId.split("/").pop() ?? result.repoId,
								description: `${result.downloads.toLocaleString()} downloads · ${result.likes} likes`,
								fileSizeBytes: file.sizeBytes,
								quantization: file.quantization,
								pipelineTag: result.pipelineTag,
								performanceTier: getPerformanceBadge(deviceRAM, file.sizeBytes),
								sha256: file.sha256,
								downloadUrl: file.downloadUrl,
								parametersB: 0,
								mmprojFilename: mmprojInfo?.filename,
								mmprojSizeBytes: mmprojInfo?.sizeBytes,
								mmprojDownloadUrl: mmprojInfo?.downloadUrl,
							});
						}
					} catch {
						// Skip repos where tree listing fails
					}
				}
				setSearchResults(displayResults);
				setError(undefined);
				// Search succeeded, so we are online
				setIsOffline(false);
			} catch (err) {
				const message = err instanceof Error ? err.message : "Search failed";
				// Detect network failures to set offline state
				if (
					message.includes("Network request failed") ||
					message.includes("network") ||
					message.includes("fetch") ||
					message.includes("Failed to fetch") ||
					message.includes("ERR_INTERNET_DISCONNECTED")
				) {
					setIsOffline(true);
					setError(undefined);
				} else if (message.includes("Rate limited")) {
					// Parse retry seconds from error message: "Rate limited. Try again in Xs."
					const retryMatch = message.match(/in (\d+)s/);
					const retrySeconds = retryMatch
						? Number.parseInt(retryMatch[1], 10)
						: 60;
					setRateLimitRetryAt(Date.now() + retrySeconds * 1000);
					setError(message);
				} else {
					setError(message);
				}
				setSearchResults([]);
			} finally {
				setIsSearching(false);
			}
		}, 500);

		return () => {
			if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
		};
	}, [searchQuery, isOffline]);

	useEffect(() => {
		if (downloadError) setError(downloadError);
	}, [downloadError]);

	const proceedWithDownload = useCallback(
		async (model: DisplayModel) => {
			const rowId = model.id;

			// Create hfModels row if not exists
			if (!store.getRow("hfModels", rowId)?.id) {
				// Fetch contextLength from API for search results that lack it
				let contextLength = model.contextLength ?? 0;
				if (!contextLength) {
					try {
						const info = await getModelInfo(model.repoId);
						contextLength = info.contextLength;
					} catch {
						// Non-fatal — fall back to 0 (provider will use DEFAULT_CONTEXT_SIZE)
					}
				}

				const localFilename = sanitizeFilename(model.repoId, model.filename);
				store.setRow("hfModels", rowId, {
					id: rowId,
					repoId: model.repoId,
					filename: model.filename,
					displayName: model.displayName,
					fileSizeBytes: model.fileSizeBytes,
					parametersB: model.parametersB,
					quantization: model.quantization,
					pipelineTag: model.pipelineTag,
					sha256: model.sha256,
					localFilename,
					downloadedAt: "",
					downloadUrl: model.downloadUrl,
					mmprojFilename: model.mmprojFilename ?? "",
					mmprojDownloadUrl: model.mmprojDownloadUrl ?? "",
					mmprojSizeBytes: model.mmprojSizeBytes ?? 0,
					mmprojLocalFilename: "",
					mmprojDownloadedAt: "",
					contextLength,
				});
			}

			// Temporarily set as selected model (startDownload reads from store)
			store.setCell("aiProviders", "huggingface", "selectedModelId", rowId);
			store.setCell(
				"aiProviders",
				"huggingface",
				"filename",
				(store.getCell("hfModels", rowId, "localFilename") as string) ?? "",
			);

			// Start download via provider
			try {
				const { createHuggingFaceProvider } = await import(
					"@/src/ai-providers/huggingface/provider"
				);
				const provider = createHuggingFaceProvider(store);
				await provider.startDownload?.();
			} catch (err) {
				setError(err instanceof Error ? err.message : "Download failed");
			}
		},
		[store],
	);

	const handleDownloadModel = useCallback(
		async (model: DisplayModel) => {
			setError(undefined);

			// Show warning for vision models missing mmproj
			if (
				model.pipelineTag === "image-text-to-text" &&
				!model.mmprojDownloadUrl
			) {
				Alert.alert(
					"Vision Model — Limited Support",
					"This model supports vision but is missing the required vision projector file. Image features won't be available — the model will work for text only.",
					[
						{ text: "Cancel", style: "cancel" },
						{
							text: "Download Anyway",
							onPress: () => proceedWithDownload(model),
						},
					],
				);
				return;
			}

			await proceedWithDownload(model);
		},
		[proceedWithDownload],
	);

	const handlePauseDownload = useCallback(async () => {
		try {
			const { pauseDownload } = await import(
				"@/src/ai-providers/huggingface/download"
			);
			await pauseDownload(store);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to pause");
		}
	}, [store]);

	const handleResumeDownload = useCallback(async () => {
		try {
			const { resumeDownload } = await import(
				"@/src/ai-providers/huggingface/download"
			);
			await resumeDownload(store);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to resume");
		}
	}, [store]);

	const handleDeleteModel = useCallback(
		(modelId: string, modelName: string, fileSizeBytes: number) => {
			const sizeGB = formatBytesGB(fileSizeBytes);
			Alert.alert(
				"Delete Model",
				`Are you sure you want to delete ${modelName}? This will free ${sizeGB} GB of storage.`,
				[
					{ text: "Cancel", style: "cancel" },
					{
						text: "Delete",
						style: "destructive",
						onPress: async () => {
							try {
								const { createHuggingFaceProvider } = await import(
									"@/src/ai-providers/huggingface/provider"
								);
								const provider = createHuggingFaceProvider(store);
								await provider.deleteModel(modelId);
								// Refresh free disk space after deletion
								getFreeDiskStorageAsync()
									.then((bytes) => setFreeDiskSpace(bytes))
									.catch(() => {});
							} catch (err) {
								setError(
									err instanceof Error ? err.message : "Failed to delete model",
								);
							}
						},
					},
				],
			);
		},
		[store],
	);

	const getModelAction = useCallback(
		(modelId: string): ModelCardAction => {
			const isSelected = selectedModelId === modelId;
			const isModelDownloading = isSelected && isDownloading;
			const isModelPaused = isSelected && isPaused;
			const row = store.getRow("hfModels", modelId);
			const isDownloaded = !!row?.downloadedAt;
			const isQueued = downloadQueue.includes(modelId);

			if (isModelDownloading) return "downloading";
			if (isModelPaused) return "resume";
			if (isQueued) return "queued";
			if (isDownloaded && isSelected) return "selected";
			if (isDownloaded) return "select";
			return "download";
		},
		[selectedModelId, isDownloading, isPaused, store, downloadQueue],
	);

	const handleModelAction = useCallback(
		(model: DisplayModel, action: ModelCardAction) => {
			if (action === "download") {
				handleDownloadModel(model);
			} else if (action === "downloading") {
				handlePauseDownload();
			} else if (action === "resume") {
				handleResumeDownload();
			} else if (action === "queued") {
				// Remove from queue
				removeFromDownloadQueue(store, model.id);
			} else if (action === "select") {
				store.setCell(
					"aiProviders",
					"huggingface",
					"selectedModelId",
					model.id,
				);
				store.setCell(
					"aiProviders",
					"huggingface",
					"filename",
					store.getCell("hfModels", model.id, "localFilename") as string,
				);
			}
		},
		[handleDownloadModel, handlePauseDownload, handleResumeDownload, store],
	);

	// Retry connectivity: clear offline flag so the search effect re-runs
	const handleRetryOnline = useCallback(() => {
		setIsOffline(false);
		// If there's a pending search query, the effect will re-fire
	}, []);

	const unfilteredModels =
		searchQuery.trim() && !isOffline ? searchResults : featuredModels;
	const filteredModels =
		activeFilter === "all"
			? unfilteredModels
			: unfilteredModels.filter((m) => m.pipelineTag === activeFilter);

	const displayModels = useMemo(() => {
		const downloading: DisplayModel[] = [];
		const queued: DisplayModel[] = [];
		const rest: DisplayModel[] = [];

		for (const model of filteredModels) {
			const action = getModelAction(model.id);
			if (action === "downloading") {
				downloading.push(model);
			} else if (action === "queued") {
				queued.push(model);
			} else {
				rest.push(model);
			}
		}

		// Sort queued by queue position
		queued.sort(
			(a, b) => downloadQueue.indexOf(a.id) - downloadQueue.indexOf(b.id),
		);

		// Sort rest based on selected option
		if (sortOption === "size-asc") {
			rest.sort((a, b) => a.fileSizeBytes - b.fileSizeBytes);
		} else {
			rest.sort((a, b) => b.fileSizeBytes - a.fileSizeBytes);
		}

		return [...downloading, ...queued, ...rest];
	}, [filteredModels, getModelAction, sortOption, downloadQueue]);

	return (
		<View style={{ flex: 1 }}>
			<SafeAreaView style={{ flex: 1 }}>
				{/* Header */}
				<View style={styles.header}>
					<Button onPress={() => router.back()} variant="ghost" size="icon">
						<ChevronLeft
							color="rgba(125,125,125,0.7)"
							strokeWidth={2}
							size={24}
						/>
					</Button>
					<Text variant="title" style={styles.headerTitle}>
						Hugging Face
					</Text>
					<View style={{ width: 40 }} />
				</View>

				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={styles.scrollContent}
					keyboardShouldPersistTaps="handled"
				>
					{/* Search Bar */}
					<View
						style={[
							styles.searchContainer,
							{ borderColor },
							isOffline && styles.searchContainerDisabled,
						]}
					>
						<Search size={16} color={mutedForeground} />
						<TextInput
							style={[
								styles.searchInput,
								{ color: foreground },
								isOffline && { opacity: 0.5 },
							]}
							placeholder={
								isOffline ? "Search unavailable offline" : "Search models..."
							}
							placeholderTextColor={mutedForeground}
							value={searchQuery}
							onChangeText={isOffline ? undefined : setSearchQuery}
							editable={!isOffline}
							autoCapitalize="none"
							autoCorrect={false}
						/>
						{isSearching ? <ActivityIndicator size="small" /> : null}
					</View>

					{/* Offline Indicator */}
					{isOffline ? (
						<Pressable onPress={handleRetryOnline} style={styles.offlineBanner}>
							<WifiOff color="#f59e0b" size={14} strokeWidth={2} />
							<Text style={styles.offlineText}>
								Offline - showing featured models. Tap to retry.
							</Text>
						</Pressable>
					) : null}

					{/* Error / Rate Limit */}
					{error ? (
						<View
							style={[
								styles.errorBox,
								rateLimitCountdown > 0 && styles.rateLimitBox,
							]}
						>
							{rateLimitCountdown > 0 ? (
								<>
									<Text style={styles.rateLimitText}>
										Rate limited — retry in {rateLimitCountdown}s
									</Text>
									<Pressable
										onPress={() => {
											setAdvancedExpanded(true);
										}}
									>
										<Text style={styles.rateLimitLink}>
											Add a Hugging Face token for higher limits
										</Text>
									</Pressable>
								</>
							) : (
								<Text style={styles.errorText}>{error}</Text>
							)}
						</View>
					) : null}

					{/* Main Tab: Search / Downloaded */}
					<View style={styles.filterRow}>
						{(
							[
								{ key: "search", label: "Search" },
								{ key: "downloaded", label: "Downloaded" },
							] as const
						).map(({ key, label }) => {
							const isActive = activeMainTab === key;
							return (
								<Pressable
									key={key}
									onPress={() => setActiveMainTab(key)}
									style={[styles.filterTab, isActive && styles.filterTabActive]}
								>
									<Text
										style={[
											styles.filterTabText,
											{ color: mutedForeground },
											isActive && styles.filterTabTextActive,
										]}
									>
										{label}
									</Text>
								</Pressable>
							);
						})}
					</View>

					{/* Filter Tabs - only shown in Search tab */}
					{activeMainTab === "search" ? (
						<View style={styles.filterRow}>
							{(
								[
									{ key: "all", label: "All" },
									{ key: "text-generation", label: "Text" },
									{ key: "image-text-to-text", label: "Vision" },
								] as const
							).map(({ key, label }) => {
								const isActive = activeFilter === key;
								return (
									<Pressable
										key={key}
										onPress={() => setActiveFilter(key)}
										style={[
											styles.filterTab,
											isActive && styles.filterTabActive,
										]}
									>
										<Text
											style={[
												styles.filterTabText,
												{ color: mutedForeground },
												isActive && styles.filterTabTextActive,
											]}
										>
											{label}
										</Text>
									</Pressable>
								);
							})}
						</View>
					) : null}

					{/* Models Section - shown in Search tab or when both tabs should show */}
					{activeMainTab === "search" ? (
						<View style={(styles.section, { paddingTop: 16 })}>
							<View style={styles.sectionHeader}>
								<Text
									style={[styles.sectionTitle, { marginBottom: 0, opacity: 1 }]}
								>
									{searchQuery.trim() && !isOffline
										? "Search Results"
										: "Featured Models"}
								</Text>
								<Pressable
									onPress={() =>
										setSortOption(
											sortOption === "size-asc" ? "size-desc" : "size-asc",
										)
									}
									style={[styles.filterTab]}
								>
									<Text style={[styles.filterTabText]}>
										Size {sortOption === "size-asc" ? "\u2191" : "\u2193"}
									</Text>
								</Pressable>
							</View>

							{isSearching && !searchResults.length ? (
								<View style={styles.loadingContainer}>
									<ActivityIndicator />
									<Text
										style={[styles.loadingText, { color: mutedForeground }]}
									>
										Searching HuggingFace...
									</Text>
								</View>
							) : displayModels.length === 0 && searchQuery.trim() ? (
								<Text style={[styles.emptyText, { color: mutedForeground }]}>
									No compatible models found
								</Text>
							) : (
								displayModels.map((model) => {
									const action = getModelAction(model.id);
									const insufficientStorage =
										freeDiskSpace !== null &&
										action === "download" &&
										model.fileSizeBytes > freeDiskSpace;
									// Show queue position if queued
									const queuePosition = downloadQueue.indexOf(model.id) + 1;
									const queueSuffix =
										queuePosition > 0 ? ` (#${queuePosition} in queue)` : "";
									return (
										<View key={model.id}>
											<HFModelCard
												name={model.displayName}
												fileSize={model.fileSizeBytes}
												quantization={model.quantization}
												pipelineTag={model.pipelineTag}
												performanceTier={model.performanceTier}
												description={
													action === "queued"
														? `Queued for download${queueSuffix}`
														: model.description
												}
												action={action}
												progress={
													action === "downloading"
														? downloadProgress
														: undefined
												}
												onAction={() => handleModelAction(model, action)}
											/>
											{insufficientStorage ? (
												<View style={styles.storageWarning}>
													<Text style={styles.storageWarningText}>
														Insufficient storage:{" "}
														{formatBytesGB(model.fileSizeBytes)} GB required,{" "}
														{formatBytesGB(freeDiskSpace)} GB available
													</Text>
												</View>
											) : null}
										</View>
									);
								})
							)}
						</View>
					) : null}

					{/* Downloaded Models Section */}
					{activeMainTab === "downloaded" && downloadedModels.length > 0 ? (
						<View style={styles.section}>
							<Text style={styles.sectionTitle}>Downloaded Models</Text>
							{downloadedModels.map((model) => {
								const deviceRAM = Device.totalMemory ?? 4 * 1024 * 1024 * 1024;
								const isSelected = selectedModelId === model.id;
								return (
									<HFModelCard
										key={model.id}
										name={model.displayName}
										fileSize={model.fileSizeBytes}
										quantization={model.quantization}
										pipelineTag={model.pipelineTag}
										performanceTier={getPerformanceBadge(
											deviceRAM,
											model.fileSizeBytes,
										)}
										description={formatRelativeDate(model.downloadedAt)}
										action={isSelected ? "selected" : "select"}
										onAction={() => {
											store.setCell(
												"aiProviders",
												"huggingface",
												"selectedModelId",
												model.id,
											);
											store.setCell(
												"aiProviders",
												"huggingface",
												"filename",
												store.getCell(
													"hfModels",
													model.id,
													"localFilename",
												) as string,
											);
										}}
										onSecondaryAction={() =>
											handleDeleteModel(
												model.id,
												model.displayName,
												model.fileSizeBytes,
											)
										}
									/>
								);
							})}
						</View>
					) : activeMainTab === "downloaded" &&
						downloadedModels.length === 0 ? (
						<View style={styles.section}>
							<Text style={[styles.emptyText, { color: mutedForeground }]}>
								No downloaded models yet. Go to the Search tab to download
								models.
							</Text>
						</View>
					) : null}

					{/* Advanced Section - Collapsible */}
					<View style={styles.section}>
						<Pressable
							onPress={() => setAdvancedExpanded(!advancedExpanded)}
							style={styles.advancedHeader}
						>
							<Text style={styles.sectionTitle}>Advanced</Text>
							{advancedExpanded ? (
								<ChevronUp size={16} color={mutedForeground} />
							) : (
								<ChevronDown size={16} color={mutedForeground} />
							)}
						</Pressable>

						{advancedExpanded ? (
							<View style={[styles.advancedContent, { borderColor }]}>
								<Text
									style={[
										styles.advancedDescription,
										{ color: mutedForeground },
									]}
								>
									Add a Hugging Face token for higher API rate limits and access
									to gated models.
								</Text>
								<TextInput
									style={[
										styles.tokenInput,
										{ color: foreground, borderColor },
									]}
									placeholder="hf_xxxxxxxxxxxxxxxxxxxx"
									placeholderTextColor={mutedForeground}
									value={hfToken}
									onChangeText={setHfToken}
									autoCapitalize="none"
									autoCorrect={false}
									secureTextEntry
								/>
								<Pressable
									onPress={() =>
										Linking.openURL("https://huggingface.co/settings/tokens")
									}
								>
									<Text style={styles.tokenLink}>
										Get your token at huggingface.co/settings/tokens
									</Text>
								</Pressable>
							</View>
						) : null}
					</View>
				</ScrollView>
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: "600",
	},
	scrollContent: {
		padding: 16,
		paddingBottom: 40,
	},
	searchContainer: {
		flexDirection: "row",
		alignItems: "center",
		borderWidth: 1,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 10,
		gap: 8,
		marginBottom: 20,
	},
	searchInput: {
		flex: 1,
		fontSize: 15,
		padding: 0,
	},
	filterRow: {
		flexDirection: "row",
		gap: 8,
		marginBottom: 8,
	},
	filterTab: {
		paddingHorizontal: 14,
		paddingVertical: 6,
		borderRadius: 16,
		backgroundColor: "rgba(125,125,125,0.1)",
	},
	filterTabActive: {
		backgroundColor: "rgba(125,125,125,0.25)",
	},
	filterTabText: {
		fontSize: 13,
		fontWeight: "500",
	},
	filterTabTextActive: {
		color: "#ffffff",
		fontWeight: "600",
	},
	section: {
		marginBottom: 24,
	},
	sectionHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
	},
	sectionTitle: {
		fontSize: 14,
		fontWeight: "600",
		marginBottom: 12,
		opacity: 0.7,
	},
	sortTab: {
		paddingHorizontal: 10,
		paddingVertical: 4,
	},
	loadingContainer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		paddingVertical: 20,
	},
	loadingText: {
		fontSize: 14,
	},
	emptyText: {
		fontSize: 14,
		textAlign: "center",
		paddingVertical: 20,
	},
	errorBox: {
		padding: 12,
		backgroundColor: "rgba(239, 68, 68, 0.1)",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "rgba(239, 68, 68, 0.3)",
		marginBottom: 16,
	},
	errorText: {
		color: "#ef4444",
		fontSize: 14,
	},
	rateLimitBox: {
		backgroundColor: "rgba(245, 158, 11, 0.1)",
		borderColor: "rgba(245, 158, 11, 0.3)",
	},
	rateLimitText: {
		color: "#f59e0b",
		fontSize: 14,
		fontWeight: "600",
	},
	rateLimitLink: {
		color: "#3b82f6",
		fontSize: 13,
		textDecorationLine: "underline",
		marginTop: 4,
	},
	storageWarning: {
		padding: 10,
		backgroundColor: "rgba(245, 158, 11, 0.12)",
		borderRadius: 8,
		marginTop: -6,
		marginBottom: 10,
	},
	storageWarningText: {
		fontSize: 13,
		color: "#f59e0b",
	},
	searchContainerDisabled: {
		opacity: 0.6,
	},
	offlineBanner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingVertical: 8,
		paddingHorizontal: 12,
		backgroundColor: "rgba(245, 158, 11, 0.12)",
		borderRadius: 8,
		marginBottom: 16,
	},
	offlineText: {
		fontSize: 13,
		color: "#f59e0b",
		flex: 1,
	},
	advancedHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 4,
	},
	advancedContent: {
		marginTop: 12,
		padding: 16,
		borderWidth: 1,
		borderRadius: 10,
		gap: 12,
	},
	advancedDescription: {
		fontSize: 13,
		lineHeight: 18,
	},
	tokenInput: {
		fontSize: 15,
		padding: 12,
		borderWidth: 1,
		borderRadius: 8,
	},
	tokenLink: {
		fontSize: 13,
		color: "#3b82f6",
		textDecorationLine: "underline",
	},
});
