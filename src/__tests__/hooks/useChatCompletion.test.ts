import { renderHook, act } from "@testing-library/react-native";
import type { CompletionResult } from "../../types/chat";

// --- Mocks ---

const mockCompletion = jest.fn();
const mockUseAIChat = jest.fn(() => ({
	isLoaded: true,
	completion: mockCompletion,
	loadModel: jest.fn(),
}));

jest.mock("@/contexts/AIChatContext", () => ({
	useAIChat: () => mockUseAIChat(),
}));

const mockUpsertChat = jest.fn();
jest.mock("@/src/actions/chat", () => ({
	upsertChat: (...args: unknown[]) => mockUpsertChat(...args),
}));

const mockUpsertMessage = jest.fn();
jest.mock("@/src/actions/message", () => ({
	upsertMessage: (...args: unknown[]) => mockUpsertMessage(...args),
}));

jest.mock("expo-haptics", () => ({
	impactAsync: jest.fn(),
	ImpactFeedbackStyle: { Light: "light", Rigid: "rigid" },
}));

jest.mock("tinybase/ui-react", () => ({
	useValue: jest.fn(() => undefined),
}));

let mockUuidCounter = 0;
jest.mock("uuid", () => ({
	v4: () => `uuid-${++mockUuidCounter}`,
}));

jest.mock("whisper-llm-cards", () => ({
	processSystemMessage: jest.fn(() => "mock system message"),
}), { virtual: true });

// Import after mocks
import { useChatCompletion } from "@/hooks/useChatCompletion";

// --- Helpers ---

/** Creates a CompletionResult with sensible defaults */
const makeResult = (
	overrides: Partial<CompletionResult> = {},
): CompletionResult => ({
	content: "AI response",
	stopped_eos: true,
	stopped_limit: 0,
	context_full: false,
	truncated: false,
	tokens_predicted: 50,
	tokens_evaluated: 10,
	...overrides,
});

/** Sets mockCompletion to invoke the partial callback then resolve */
const setupCompletion = (
	text: string,
	result: CompletionResult = makeResult(),
) => {
	mockCompletion.mockImplementation(
		async (
			_msgs: unknown,
			cb: (token: string) => void,
		): Promise<CompletionResult> => {
			cb(text);
			return result;
		},
	);
};

const defaultOptions = {
	chatId: "chat-1",
	messages: [],
	onChatCreated: jest.fn(),
};

// --- Tests ---

describe("useChatCompletion", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockUuidCounter = 0;
		mockUseAIChat.mockReturnValue({
			isLoaded: true,
			completion: mockCompletion,
			loadModel: jest.fn(),
		});
	});

	describe("initial state", () => {
		it("returns correct initial values", () => {
			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			expect(result.current.isAiTyping).toBe(false);
			expect(result.current.streamingText).toBe("");
			expect(result.current.isCutOff).toBe(false);
			expect(result.current.chatNotice).toBeNull();
			expect(result.current.continueMessage).toBeNull();
		});
	});

	describe("sendMessage", () => {
		it("ignores empty messages", async () => {
			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("   ");
			});

			expect(mockUpsertMessage).not.toHaveBeenCalled();
		});

		it("saves user message and AI response", async () => {
			setupCompletion("Hello!");

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("Hi");
			});

			// User message saved
			expect(mockUpsertMessage).toHaveBeenCalledWith(
				"uuid-1",
				"chat-1",
				"Hi",
				"user",
			);

			// AI response saved
			expect(mockUpsertMessage).toHaveBeenCalledWith(
				"uuid-2",
				"chat-1",
				"Hello!",
				"system",
			);
		});

		it("creates a new chat if chatId is undefined", async () => {
			setupCompletion("response");
			const onChatCreated = jest.fn();

			const { result } = renderHook(() =>
				useChatCompletion({
					chatId: undefined,
					messages: [],
					onChatCreated,
				}),
			);

			await act(async () => {
				await result.current.sendMessage("Hello");
			});

			expect(mockUpsertChat).toHaveBeenCalledWith(
				"uuid-1",
				"Hello",
				undefined,
			);
			expect(onChatCreated).toHaveBeenCalledWith("uuid-1");
		});

		it("clears previous chatNotice on new message", async () => {
			// First call: force an error to set chatNotice
			mockCompletion.mockRejectedValueOnce(new Error("fail"));
			setupCompletion("ok");

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("first");
			});

			expect(result.current.chatNotice).not.toBeNull();

			await act(async () => {
				await result.current.sendMessage("second");
			});

			expect(result.current.chatNotice).toBeNull();
		});

		it("sets error notice on completion failure", async () => {
			mockCompletion.mockRejectedValueOnce(new Error("model crashed"));

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("test");
			});

			expect(result.current.chatNotice).toEqual({
				type: "error",
				message:
					"Something went wrong. Try sending your message again.",
			});
			expect(result.current.isAiTyping).toBe(false);
			expect(result.current.streamingText).toBe("");
		});

		it("sets isCutOff and exposes continueMessage when response is cut off", async () => {
			const cutOffResult = makeResult({
				stopped_eos: false,
				tokens_predicted: 300,
			});
			setupCompletion("partial response...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("tell me a story");
			});

			expect(result.current.isCutOff).toBe(true);
			expect(result.current.continueMessage).not.toBeNull();
		});

		it("does not set isCutOff when response completes normally", async () => {
			const normalResult = makeResult({ stopped_eos: true });
			setupCompletion("complete response", normalResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("hello");
			});

			expect(result.current.isCutOff).toBe(false);
			expect(result.current.continueMessage).toBeNull();
		});

		it("does not call completion when model is not loaded", async () => {
			mockUseAIChat.mockReturnValue({
				isLoaded: false,
				completion: mockCompletion,
				loadModel: jest.fn(),
			});

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("hello");
			});

			// User message still saved
			expect(mockUpsertMessage).toHaveBeenCalledTimes(1);
			// But completion never called
			expect(mockCompletion).not.toHaveBeenCalled();
		});
	});

	describe("continueMessage", () => {
		it("saves continuation as a new separate message", async () => {
			// First: send a message that gets cut off
			const cutOffResult = makeResult({
				stopped_eos: false,
				tokens_predicted: 300,
			});
			setupCompletion("partial...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("tell me 50 tips");
			});

			expect(result.current.isCutOff).toBe(true);
			mockUpsertMessage.mockClear();
			mockUuidCounter = 10;

			// Now continue — set up a normal completion
			const normalResult = makeResult({ stopped_eos: true });
			setupCompletion("...continued text", normalResult);

			await act(async () => {
				await result.current.continueMessage!();
			});

			// Should save as a NEW message, not update the old one
			expect(mockUpsertMessage).toHaveBeenCalledWith(
				"uuid-11",
				"chat-1",
				"...continued text",
				"system",
			);
		});

		it("includes hidden continue instruction in completion messages", async () => {
			const cutOffResult = makeResult({
				stopped_eos: false,
				tokens_predicted: 300,
			});
			setupCompletion("partial...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("test");
			});

			mockCompletion.mockClear();
			const normalResult = makeResult({ stopped_eos: true });
			setupCompletion("more text", normalResult);

			await act(async () => {
				await result.current.continueMessage!();
			});

			// Check that the last message in the completion array is the hidden user continue
			const completionCall = mockCompletion.mock.calls[0];
			const messages = completionCall[0];
			const lastMessage = messages[messages.length - 1];
			expect(lastMessage).toEqual({
				role: "user",
				content: "Continue from where you left off.",
			});

			// The assistant partial should be second to last
			const assistantMessage = messages[messages.length - 2];
			expect(assistantMessage.role).toBe("assistant");
		});

		it("clears isCutOff when continuation completes normally", async () => {
			const cutOffResult = makeResult({
				stopped_eos: false,
				tokens_predicted: 300,
			});
			setupCompletion("partial...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("test");
			});

			expect(result.current.isCutOff).toBe(true);

			const normalResult = makeResult({ stopped_eos: true });
			setupCompletion("done", normalResult);

			await act(async () => {
				await result.current.continueMessage!();
			});

			expect(result.current.isCutOff).toBe(false);
			expect(result.current.continueMessage).toBeNull();
		});

		it("keeps isCutOff if continuation is also cut off", async () => {
			const cutOffResult = makeResult({
				stopped_eos: false,
				tokens_predicted: 300,
			});
			setupCompletion("partial...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("test");
			});

			// Continue but still cut off
			setupCompletion("still partial...", cutOffResult);

			await act(async () => {
				await result.current.continueMessage!();
			});

			expect(result.current.isCutOff).toBe(true);
			expect(result.current.continueMessage).not.toBeNull();
		});

		it("sets error notice on continuation failure", async () => {
			const cutOffResult = makeResult({
				stopped_eos: false,
				tokens_predicted: 300,
			});
			setupCompletion("partial...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("test");
			});

			// Continue fails
			mockCompletion.mockRejectedValueOnce(new Error("crash"));

			await act(async () => {
				await result.current.continueMessage!();
			});

			expect(result.current.chatNotice).toEqual({
				type: "error",
				message: "Couldn't continue the response. Try again.",
			});
			expect(result.current.isAiTyping).toBe(false);
		});

		it("clears chatNotice at the start of continuation", async () => {
			// Get into a cut-off state with an error notice
			mockCompletion.mockRejectedValueOnce(new Error("fail"));

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			// First send fails → error notice
			await act(async () => {
				await result.current.sendMessage("first");
			});
			expect(result.current.chatNotice).not.toBeNull();

			// Now send again and get cut off
			const cutOffResult = makeResult({
				stopped_eos: false,
				tokens_predicted: 300,
			});
			setupCompletion("partial...", cutOffResult);

			await act(async () => {
				await result.current.sendMessage("second");
			});

			// chatNotice should have been cleared by sendMessage
			expect(result.current.chatNotice).toBeNull();
			expect(result.current.isCutOff).toBe(true);

			// Set up a successful continue
			const normalResult = makeResult({ stopped_eos: true });
			setupCompletion("done", normalResult);

			await act(async () => {
				await result.current.continueMessage!();
			});

			// Notice should still be null (no error)
			expect(result.current.chatNotice).toBeNull();
		});

		it("does nothing if model is not loaded", async () => {
			const cutOffResult = makeResult({
				stopped_eos: false,
				tokens_predicted: 300,
			});
			setupCompletion("partial...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("test");
			});

			// Unload the model
			mockUseAIChat.mockReturnValue({
				isLoaded: false,
				completion: mockCompletion,
				loadModel: jest.fn(),
			});

			const { result: result2 } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			// continueMessage should be null since isCutOff resets per hook instance
			expect(result2.current.continueMessage).toBeNull();
		});
	});

	describe("context_full handling", () => {
		it("does not set isCutOff when context_full is true", async () => {
			const contextFullResult = makeResult({
				stopped_eos: false,
				context_full: true,
				tokens_predicted: 50,
			});
			setupCompletion("response", contextFullResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("test");
			});

			// context_full means isResponseCutOff returns false
			expect(result.current.isCutOff).toBe(false);
		});
	});
});
