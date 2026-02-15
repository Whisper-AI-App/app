// Simple character heuristic: ~4 chars per token
const CHARS_PER_TOKEN = 4;
const CONTEXT_SIZE = 2048;
const RESPONSE_RESERVE = 300;
// Approximate system message size for warning calculation
const SYSTEM_MESSAGE_ESTIMATE = 200;

export function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function wouldTruncate(totalMessageChars: number): boolean {
	const messageTokens = Math.ceil(totalMessageChars / CHARS_PER_TOKEN);
	const available = CONTEXT_SIZE - SYSTEM_MESSAGE_ESTIMATE - RESPONSE_RESERVE;
	return messageTokens > available;
}

export function truncateMessages(
	systemMessage: string,
	messages: { role: string; content: string }[],
	maxTokens = CONTEXT_SIZE,
): { role: string; content: string }[] {
	const available =
		maxTokens - estimateTokens(systemMessage) - RESPONSE_RESERVE;

	let tokenCount = 0;
	let cutoffIndex = 0;

	// Work backwards from newest
	for (let i = messages.length - 1; i >= 0; i--) {
		const msgTokens = estimateTokens(messages[i].content);
		if (tokenCount + msgTokens > available) {
			cutoffIndex = i + 1;
			break;
		}
		tokenCount += msgTokens;
	}

	return messages.slice(cutoffIndex);
}
