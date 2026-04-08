import type { CompletionMessagePart } from "../ai-providers/types";

// Simple character heuristic: ~4 chars per token
const CHARS_PER_TOKEN = 4;
export const DEFAULT_CONTEXT_SIZE = 2048;
const RESPONSE_RESERVE = 300;
// Approximate system message size for warning calculation
const SYSTEM_MESSAGE_ESTIMATE = 200;
// Default image token cost when no card value is available
const DEFAULT_IMAGE_MAX_TOKENS = 256;

export function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Calculate the effective image token budget capped at 25% of context window.
 */
export function getEffectiveImageMaxTokens(
	cardImageMaxTokens: number | undefined,
	contextSize: number,
): number {
	const cap = Math.floor(contextSize * 0.25);
	return Math.min(cardImageMaxTokens ?? DEFAULT_IMAGE_MAX_TOKENS, cap);
}

/**
 * Per-image token budget when multiple images share the budget.
 */
export function getPerImageTokens(
	effectiveMax: number,
	numImages: number,
): number {
	if (numImages <= 0) return 0;
	return Math.floor(effectiveMax / numImages);
}

/**
 * Count image parts in a message's content.
 */
function countImages(content: string | CompletionMessagePart[]): number {
	if (typeof content === "string") return 0;
	return content.filter((p) => p.type === "image").length;
}

/**
 * Estimate token cost for a message, including image token overhead.
 */
function estimateMessageTokens(
	content: string | CompletionMessagePart[],
	imageTokensPerImage: number,
): number {
	if (typeof content === "string") {
		return estimateTokens(content);
	}
	let tokens = 0;
	for (const part of content) {
		if (part.type === "text") {
			tokens += estimateTokens(part.text);
		} else if (part.type === "image") {
			tokens += imageTokensPerImage;
		} else if (part.type === "audio" || part.type === "file") {
			// Count alt text as minimal token cost for audio/file parts
			if (part.alt) {
				tokens += estimateTokens(part.alt);
			}
		}
	}
	return tokens;
}

export function wouldTruncate(
	totalMessageChars: number,
	contextSize: number = DEFAULT_CONTEXT_SIZE,
): boolean {
	const messageTokens = Math.ceil(totalMessageChars / CHARS_PER_TOKEN);
	const available = contextSize - SYSTEM_MESSAGE_ESTIMATE - RESPONSE_RESERVE;
	return messageTokens > available;
}

export function truncateMessages(
	systemMessage: string,
	messages: { role: "user" | "assistant" | "system" | "tool"; content: string | CompletionMessagePart[] }[],
	maxTokens = DEFAULT_CONTEXT_SIZE,
	imageMaxTokens?: number,
): { role: "user" | "assistant" | "system" | "tool"; content: string | CompletionMessagePart[] }[] {
	const available =
		maxTokens - estimateTokens(systemMessage) - RESPONSE_RESERVE;

	// Calculate per-image token cost across all images in the conversation
	const totalImages = messages.reduce((sum, m) => sum + countImages(m.content), 0);
	const effectiveImageMax = getEffectiveImageMaxTokens(imageMaxTokens, maxTokens);
	const perImageTokens = totalImages > 0 ? getPerImageTokens(effectiveImageMax, totalImages) : 0;

	let tokenCount = 0;
	let cutoffIndex = 0;

	// Work backwards from newest
	for (let i = messages.length - 1; i >= 0; i--) {
		const msgTokens = estimateMessageTokens(messages[i].content, perImageTokens);
		if (tokenCount + msgTokens > available) {
			cutoffIndex = i + 1;
			break;
		}
		tokenCount += msgTokens;
	}

	return messages.slice(cutoffIndex);
}
