import * as Device from "expo-device";
import {
	getLatestConfig,
	recommendModelCard,
	type WhisperLLMCard,
	type WhisperLLMCardsJSON,
	whisperLLMCardsJson,
} from "whisper-llm-cards";
import { mainStore } from "../../stores/main/main-store";
import { bytesToGB } from "../../utils/bytes";
import { validateModelFileName } from "../../utils/generate-model-filename";
import { DEFAULT_AI_CHAT_MODEL } from "./constants";
import type { ModelUpdateInfo } from "./types";

/**
 * Fetches the latest recommended model configuration
 * @returns Promise with config and recommended card
 */
export async function fetchLatestRecommendedModel(): Promise<{
	config: WhisperLLMCardsJSON;
	recommendedCard: WhisperLLMCard;
	cardId: string;
}> {
	try {
		const config = await getLatestConfig();

		// Get device RAM in GB for model recommendation
		const deviceMemoryBytes = Device.totalMemory;
		const ramGB = deviceMemoryBytes ? bytesToGB(deviceMemoryBytes) : undefined;

		console.info(`Device RAM GB: ${ramGB}`);

		const cardId = recommendModelCard(ramGB);
		const recommendedCard = config.cards[cardId];

		console.info(`Recommended card ID: ${cardId}`);

		if (!recommendedCard) {
			throw new Error(
				`Recommended card "${cardId}" not found in configuration`,
			);
		}

		return { config, recommendedCard, cardId };
	} catch (error) {
		console.error("[AI Model] Failed to fetch latest config:", error);
		// Fallback to bundled config
		return {
			config: whisperLLMCardsJson,
			recommendedCard: DEFAULT_AI_CHAT_MODEL,
			cardId: whisperLLMCardsJson.defaultRecommendedCard,
		};
	}
}

/**
 * Updates the stored model card metadata without downloading
 * Use this when only metadata has changed (same sourceUrl)
 */
export function updateModelCard(
	card: WhisperLLMCard,
	cardId: string,
	configVersion: string,
): void {
	mainStore.setValue("ai_chat_model_card", JSON.stringify(card));
	mainStore.setValue("ai_chat_model_cardId", cardId);
	mainStore.setValue("ai_chat_model_config_version", configVersion);
}

/**
 * Gets the currently stored model card
 * @returns The stored card or null if not found
 */
export function getStoredModelCard(): WhisperLLMCard | null {
	const cardJson = mainStore.getValue("ai_chat_model_card") as
		| string
		| undefined;
	if (!cardJson) return null;

	try {
		return JSON.parse(cardJson) as WhisperLLMCard;
	} catch (error) {
		console.error("[AI Model] Failed to parse stored card:", error);
		return null;
	}
}

/**
 * Compares two model cards for equality
 * Performs a deep comparison of all fields
 */
export function areCardsEqual(
	card1: WhisperLLMCard | null,
	card2: WhisperLLMCard,
): boolean {
	if (!card1) return false;

	// Deep equality check using JSON comparison
	// This automatically handles all fields, including any newly added ones
	return JSON.stringify(card1) === JSON.stringify(card2);
}

/**
 * Checks if a model update is available
 * @returns Update information including whether download is required
 */
export async function checkForModelUpdates(): Promise<ModelUpdateInfo> {
	const storedConfigVersion = mainStore.getValue(
		"ai_chat_model_config_version",
	) as string | undefined;
	// Use filename instead of full path (path changes between app updates)
	const filename = mainStore.getValue("ai_chat_model_filename") as
		| string
		| undefined;

	// Fetch latest recommended model
	const { config, recommendedCard, cardId } =
		await fetchLatestRecommendedModel();

	const currentCard = getStoredModelCard();
	const currentVersion = storedConfigVersion || null;
	const newVersion = config.version;

	// Check if filename matches expected version/hash
	let filenameValid = false;
	if (filename && currentCard && storedConfigVersion) {
		filenameValid = validateModelFileName(
			filename,
			currentCard,
			storedConfigVersion,
		);
		console.log("[checkForModelUpdates] Filename validation:", {
			filename,
			isValid: filenameValid,
		});
	}

	// If filename doesn't match, treat as version mismatch (force update)
	if (filename && !filenameValid && currentCard) {
		console.log(
			"[checkForModelUpdates] Filename mismatch detected - treating as outdated",
		);
		return {
			hasUpdate: true,
			currentCard,
			newCard: recommendedCard,
			currentVersion,
			newVersion,
			requiresDownload: true,
			reason: "filename_invalid",
		};
	}

	// Check version mismatch
	const versionsMatch = currentVersion === newVersion;

	if (!versionsMatch) {
		console.log("[checkForModelUpdates] Version mismatch:", {
			currentVersion,
			newVersion,
		});
	}

	// Check if cards are identical (using deep comparison)
	const cardsMatch = areCardsEqual(currentCard, recommendedCard);

	if (!cardsMatch) {
		console.log("[checkForModelUpdates] Card metadata differs:", {
			currentCard,
			recommendedCard,
		});
	}

	// No update needed if versions match AND cards match AND filename is valid (or no file yet)
	if (versionsMatch && cardsMatch && (filenameValid || !filename)) {
		console.log(
			"[checkForModelUpdates] No update available, versions and metadata match",
		);
		return {
			hasUpdate: false,
			currentCard,
			newCard: recommendedCard,
			currentVersion,
			newVersion,
			requiresDownload: false,
		};
	}

	// Determine if download is required
	// Download needed if:
	// 1. sourceUrl changed (different model file)
	// 2. Filename is invalid (file is outdated/corrupted)
	const requiresDownload =
		currentCard?.sourceUrl !== recommendedCard.sourceUrl || !filenameValid;

	console.log("[checkForModelUpdates] Update needed:", {
		requiresDownload,
		reason: !versionsMatch
			? "version_mismatch"
			: !cardsMatch
				? "metadata_changed"
				: "filename_invalid",
	});

	// If metadata-only update (no download required), update card immediately
	if (!requiresDownload) {
		updateModelCard(recommendedCard, cardId, newVersion);
		console.log(
			"[checkForModelUpdates] Metadata-only update - card updated to version",
			newVersion,
		);
	}

	return {
		hasUpdate: true,
		currentCard,
		newCard: recommendedCard,
		currentVersion,
		newVersion,
		requiresDownload,
		reason: !versionsMatch
			? "version_mismatch"
			: !cardsMatch
				? "metadata_changed"
				: "filename_invalid",
	};
}
