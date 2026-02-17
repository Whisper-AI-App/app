import { type WhisperLLMCard, whisperLLMCardsJson } from "whisper-llm-cards";

// Default fallback model from bundled config
export const DEFAULT_AI_CHAT_MODEL: WhisperLLMCard =
	whisperLLMCardsJson.cards[whisperLLMCardsJson.defaultRecommendedCard];
