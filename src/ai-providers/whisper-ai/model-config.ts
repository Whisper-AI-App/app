import * as Device from "expo-device";
import type { Store } from "tinybase";
import {
	getLatestConfig,
	recommendModelCard,
	type WhisperLLMCard,
	type WhisperLLMCardsJSON,
	whisperLLMCardsJson,
} from "whisper-llm-cards";
import { bytesToGB } from "../../utils/bytes";
import { validateModelFileName } from "../../utils/generate-model-filename";
import { DEFAULT_AI_CHAT_MODEL } from "./constants";

export interface ModelUpdateInfo {
	hasUpdate: boolean;
	currentCard: WhisperLLMCard | null;
	newCard: WhisperLLMCard;
	currentVersion: string | null;
	newVersion: string;
	requiresDownload: boolean;
	reason?: "version_mismatch" | "metadata_changed" | "filename_invalid";
}

/**
 * Fetches the latest recommended model configuration
 */
export async function fetchLatestRecommendedModel(): Promise<{
	config: WhisperLLMCardsJSON;
	recommendedCard: WhisperLLMCard;
	cardId: string;
}> {
	try {
		const config = await getLatestConfig();

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
		return {
			config: whisperLLMCardsJson,
			recommendedCard: DEFAULT_AI_CHAT_MODEL,
			cardId: whisperLLMCardsJson.defaultRecommendedCard,
		};
	}
}

/**
 * Updates the stored model card metadata in aiProviders table
 */
export function updateModelCard(
	store: Store,
	card: WhisperLLMCard,
	cardId: string,
	configVersion: string,
): void {
	store.setCell("aiProviders", "whisper-ai", "modelCard", JSON.stringify(card));
	store.setCell("aiProviders", "whisper-ai", "modelCardId", cardId);
	store.setCell("aiProviders", "whisper-ai", "configVersion", configVersion);
}

/**
 * Gets the currently stored model card from aiProviders table
 */
export function getStoredModelCard(store: Store): WhisperLLMCard | null {
	const cardJson = store.getCell(
		"aiProviders",
		"whisper-ai",
		"modelCard",
	) as string | undefined;
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
 */
export function areCardsEqual(
	card1: WhisperLLMCard | null,
	card2: WhisperLLMCard,
): boolean {
	if (!card1) return false;
	return JSON.stringify(card1) === JSON.stringify(card2);
}

/**
 * Checks if a model update is available
 */
export async function checkForModelUpdates(
	store: Store,
): Promise<ModelUpdateInfo> {
	const storedConfigVersion = store.getCell(
		"aiProviders",
		"whisper-ai",
		"configVersion",
	) as string | undefined;
	const filename = store.getCell(
		"aiProviders",
		"whisper-ai",
		"filename",
	) as string | undefined;

	const { config, recommendedCard, cardId } =
		await fetchLatestRecommendedModel();

	const currentCard = getStoredModelCard(store);
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
	}

	// If filename doesn't match, treat as version mismatch
	if (filename && !filenameValid && currentCard) {
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

	const versionsMatch = currentVersion === newVersion;
	const cardsMatch = areCardsEqual(currentCard, recommendedCard);

	if (versionsMatch && cardsMatch && (filenameValid || !filename)) {
		return {
			hasUpdate: false,
			currentCard,
			newCard: recommendedCard,
			currentVersion,
			newVersion,
			requiresDownload: false,
		};
	}

	const requiresDownload =
		currentCard?.sourceUrl !== recommendedCard.sourceUrl || !filenameValid;

	// If metadata-only update, apply immediately
	if (!requiresDownload) {
		updateModelCard(store, recommendedCard, cardId, newVersion);
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
