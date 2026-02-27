import { renderHook, act } from "@testing-library/react-native";
import type { CompletionResult } from "../../ai-providers/types";

// --- Mocks ---

const mockCompletion = jest.fn();
const mockClearCache = jest.fn().mockResolvedValue(undefined);
const mockStopCompletion = jest.fn();
const mockGetSystemMessage = jest.fn(() => "mock system message");
const mockGetContextSize = jest.fn(() => 4096);
const mockIsConfigured = jest.fn(() => true);

const mockActiveProvider = {
	id: "whisper-ai",
	name: "Whisper AI",
	completion: mockCompletion,
	stopCompletion: mockStopCompletion,
	clearCache: mockClearCache,
	getSystemMessage: mockGetSystemMessage,
	getContextSize: mockGetContextSize,
	isConfigured: mockIsConfigured,
};

jest.mock("@/contexts/AIProviderContext", () => ({
	useAIProvider: () => ({
		activeProvider: mockActiveProvider,
		providers: [mockActiveProvider],
		isSettingUp: false,
		setupError: null,
		setActiveProvider: jest.fn(),
		enableProvider: jest.fn(),
		disableProvider: jest.fn(),
	}),
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

// Import after mocks
import { useChatCompletion } from "@/hooks/useChatCompletion";

// --- Helpers ---

/** Creates a CompletionResult with sensible defaults */
const makeResult = (
	overrides: Partial<CompletionResult> = {},
): CompletionResult => ({
	content: "AI response",
	finishReason: "stop",
	usage: {
		promptTokens: 10,
		completionTokens: 50,
	},
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
		mockIsConfigured.mockReturnValue(true);
	});

	describe("initial state", () => {
		it("returns correct initial values", () => {
			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			expect(result.current.isAiTyping).toBe(false);
			expect(result.current.streamingText).toBe("");
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

		it("saves user message and AI response with status", async () => {
			setupCompletion("Hello!");

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("Hi");
			});

			// User message saved with status "done"
			expect(mockUpsertMessage).toHaveBeenCalledWith(
				"uuid-1",
				"chat-1",
				"Hi",
				"user",
				"whisper-ai",
				"done",
			);

			// AI response saved with status "done"
			expect(mockUpsertMessage).toHaveBeenCalledWith(
				"uuid-2",
				"chat-1",
				"Hello!",
				"assistant",
				"whisper-ai",
				"done",
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

		it("saves error message with status 'error' on completion failure", async () => {
			mockCompletion.mockRejectedValueOnce(new Error("model crashed"));

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("test");
			});

			// Should save empty AI message with error status
			expect(mockUpsertMessage).toHaveBeenCalledWith(
				expect.any(String),
				"chat-1",
				"",
				"assistant",
				"whisper-ai",
				"error",
			);
			expect(result.current.isAiTyping).toBe(false);
			expect(result.current.streamingText).toBe("");
		});

		it("saves AI message with status 'length' and exposes continueMessage when response is cut off", async () => {
			const cutOffResult = makeResult({
				finishReason: "length",
			});
			setupCompletion("partial response...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("tell me a story");
			});

			// AI message should be saved with "length" status
			expect(mockUpsertMessage).toHaveBeenCalledWith(
				expect.any(String),
				"chat-1",
				"partial response...",
				"assistant",
				"whisper-ai",
				"length",
			);
			expect(result.current.continueMessage).not.toBeNull();
		});

		it("saves AI message with status 'done' when response completes normally", async () => {
			const normalResult = makeResult({ finishReason: "stop" });
			setupCompletion("complete response", normalResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("hello");
			});

			expect(mockUpsertMessage).toHaveBeenCalledWith(
				expect.any(String),
				"chat-1",
				"complete response",
				"assistant",
				"whisper-ai",
				"done",
			);
			expect(result.current.continueMessage).toBeNull();
		});

		it("does not call completion when provider is not configured", async () => {
			mockIsConfigured.mockReturnValue(false);

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
			const cutOffResult = makeResult({ finishReason: "length" });
			setupCompletion("partial...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("tell me 50 tips");
			});

			expect(result.current.continueMessage).not.toBeNull();
			mockUpsertMessage.mockClear();
			mockUuidCounter = 10;

			const normalResult = makeResult({ finishReason: "stop" });
			setupCompletion("...continued text", normalResult);

			await act(async () => {
				await result.current.continueMessage!();
			});

			expect(mockUpsertMessage).toHaveBeenCalledWith(
				"uuid-11",
				"chat-1",
				"...continued text",
				"assistant",
				"whisper-ai",
				"done",
			);
		});

		it("includes hidden continue instruction in completion messages", async () => {
			const cutOffResult = makeResult({ finishReason: "length" });
			setupCompletion("partial...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("test");
			});

			mockCompletion.mockClear();
			const normalResult = makeResult({ finishReason: "stop" });
			setupCompletion("more text", normalResult);

			await act(async () => {
				await result.current.continueMessage!();
			});

			const completionCall = mockCompletion.mock.calls[0];
			const messages = completionCall[0];
			const lastMessage = messages[messages.length - 1];
			expect(lastMessage).toEqual({
				role: "user",
				content: "Continue from where you left off.",
			});

			const assistantMessage = messages[messages.length - 2];
			expect(assistantMessage.role).toBe("assistant");
		});

		it("clears continueMessage when continuation completes normally", async () => {
			const cutOffResult = makeResult({ finishReason: "length" });
			setupCompletion("partial...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("test");
			});

			expect(result.current.continueMessage).not.toBeNull();

			const normalResult = makeResult({ finishReason: "stop" });
			setupCompletion("done", normalResult);

			await act(async () => {
				await result.current.continueMessage!();
			});

			expect(result.current.continueMessage).toBeNull();
		});

		it("keeps continueMessage if continuation is also cut off", async () => {
			const cutOffResult = makeResult({ finishReason: "length" });
			setupCompletion("partial...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("test");
			});

			setupCompletion("still partial...", cutOffResult);

			await act(async () => {
				await result.current.continueMessage!();
			});

			expect(result.current.continueMessage).not.toBeNull();
		});

		it("saves error message on continuation failure", async () => {
			const cutOffResult = makeResult({ finishReason: "length" });
			setupCompletion("partial...", cutOffResult);

			const { result } = renderHook(() =>
				useChatCompletion(defaultOptions),
			);

			await act(async () => {
				await result.current.sendMessage("test");
			});

			mockUpsertMessage.mockClear();
			mockCompletion.mockRejectedValueOnce(new Error("crash"));

			await act(async () => {
				await result.current.continueMessage!();
			});

			// Should save empty AI message with error status
			expect(mockUpsertMessage).toHaveBeenCalledWith(
				expect.any(String),
				"chat-1",
				"",
				"assistant",
				"whisper-ai",
				"error",
			);
			expect(result.current.isAiTyping).toBe(false);
		});
	});
});
