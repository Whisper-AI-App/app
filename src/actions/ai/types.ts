import type { WhisperLLMCard } from "whisper-llm-cards";

export interface ModelUpdateInfo {
	hasUpdate: boolean;
	currentCard: WhisperLLMCard | null;
	newCard: WhisperLLMCard;
	currentVersion: string | null;
	newVersion: string;
	requiresDownload: boolean;
	reason?: "version_mismatch" | "metadata_changed" | "filename_invalid";
}
