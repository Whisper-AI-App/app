import { createStore } from "tinybase";
import type { Store } from "tinybase";
import * as SecureStore from "expo-secure-store";

// Mock secure store
jest.mock("expo-secure-store");

const { __resetStore } = SecureStore as typeof SecureStore & {
	__resetStore: () => void;
};

// Mock @ai-sdk/openai
const mockResponses = jest.fn();
const mockCreateOpenAI = jest.fn(() => {
	const provider = jest.fn();
	provider.responses = mockResponses;
	return provider;
});
jest.mock("@ai-sdk/openai", () => ({
	createOpenAI: (...args: unknown[]) => mockCreateOpenAI(...args),
}));

// Mock ai package streamText
const mockTextStream = {
	[Symbol.asyncIterator]: jest.fn(),
};
const mockStreamTextResult = {
	textStream: mockTextStream,
	finishReason: Promise.resolve("stop"),
	usage: Promise.resolve({ inputTokens: 10, outputTokens: 5 }),
	toolCalls: Promise.resolve([]),
};
const mockStreamText = jest.fn(() => mockStreamTextResult);
jest.mock("ai", () => ({
	streamText: (...args: unknown[]) => mockStreamText(...args),
}));

// Mock expo/fetch
const mockExpoFetch = jest.fn();
jest.mock("expo/fetch", () => ({
	fetch: (...args: unknown[]) => mockExpoFetch(...args),
}));

// Mock message-converter
jest.mock("../../ai-providers/message-converter", () => ({
	convertMessagesForAISDK: jest.fn(async (messages: unknown[]) => messages),
}));

// Mock token-refresh
const mockGetValidAccessToken = jest.fn();
jest.mock("../../ai-providers/token-refresh", () => ({
	getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}));

// Mock secure-credentials
const mockGetCredential = jest.fn();
const mockDeleteProviderCredentials = jest.fn();
jest.mock("../../actions/secure-credentials", () => ({
	getCredential: (...args: unknown[]) => mockGetCredential(...args),
	setCredential: jest.fn(),
	deleteProviderCredentials: (...args: unknown[]) => mockDeleteProviderCredentials(...args),
}));

// Mock oauth
const mockRequestDeviceCode = jest.fn();
const mockPollForAuthorization = jest.fn();
const mockCancelPolling = jest.fn();
jest.mock("../../ai-providers/openai/oauth", () => ({
	requestDeviceCode: (...args: unknown[]) => mockRequestDeviceCode(...args),
	pollForAuthorization: (...args: unknown[]) => mockPollForAuthorization(...args),
	cancelPolling: (...args: unknown[]) => mockCancelPolling(...args),
	OPENAI_CLIENT_ID: "test-client-id",
	OPENAI_TOKEN_URL: "https://auth.openai.com/oauth/token",
}));

// Import after mocks
import { createOpenAIProvider } from "../../ai-providers/openai/provider";

describe("OpenAI Provider", () => {
	let store: Store;
	let provider: ReturnType<typeof createOpenAIProvider>;

	beforeEach(() => {
		jest.clearAllMocks();
		__resetStore();
		store = createStore();
		provider = createOpenAIProvider(store);

		// Default: token refresh returns a valid token
		mockGetValidAccessToken.mockResolvedValue("test-access-token");
		mockGetCredential.mockResolvedValue("test-account-id");

		// Default: stream yields nothing (override in specific tests)
		mockTextStream[Symbol.asyncIterator].mockReturnValue({
			next: jest.fn(() => Promise.resolve({ value: undefined, done: true })),
		});
	});

	describe("identity", () => {
		it("has correct provider metadata", () => {
			expect(provider.id).toBe("openai");
			expect(provider.name).toBe("ChatGPT");
			expect(provider.type).toBe("cloud");
			expect(provider.defaultModelId).toBe("gpt-5.4");
			expect(provider.capabilities).toEqual({
				oauth: true,
				download: false,
				userApiKey: false,
			});
		});
	});

	describe("enable()", () => {
		it("creates TinyBase row with needs_setup status", () => {
			provider.enable();
			const row = store.getRow("aiProviders", "openai");
			expect(row.id).toBe("openai");
			expect(row.status).toBe("needs_setup");
			expect(row.error).toBe("");
			expect(row.selectedModelId).toBe("");
		});
	});

	describe("disable()", () => {
		it("cancels polling, deletes credentials, and removes row", async () => {
			provider.enable();
			await provider.disable();

			expect(mockCancelPolling).toHaveBeenCalled();
			expect(mockDeleteProviderCredentials).toHaveBeenCalledWith("openai");
			expect(store.getRow("aiProviders", "openai")).toEqual({});
		});
	});

	describe("setup()", () => {
		it("transitions to ready when token exists", async () => {
			provider.enable();
			await provider.setup();

			expect(store.getCell("aiProviders", "openai", "status")).toBe("ready");
			expect(store.getCell("aiProviders", "openai", "error")).toBe("");
		});

		it("transitions to needs_setup when no token", async () => {
			provider.enable();
			mockGetValidAccessToken.mockResolvedValue(null);

			await provider.setup();

			expect(store.getCell("aiProviders", "openai", "status")).toBe("needs_setup");
		});
	});

	describe("startOAuth()", () => {
		it("requests device code and starts polling", async () => {
			provider.enable();
			mockRequestDeviceCode.mockResolvedValue({
				userCode: "ABCD-1234",
				deviceAuthId: "auth-123",
			});
			mockPollForAuthorization.mockResolvedValue(undefined);

			await provider.startOAuth();

			expect(mockRequestDeviceCode).toHaveBeenCalledWith(store);
			expect(mockPollForAuthorization).toHaveBeenCalledWith(
				store,
				"auth-123",
				"ABCD-1234",
			);

			// Device code stored in modelCard for UI display
			const modelCard = JSON.parse(
				store.getCell("aiProviders", "openai", "modelCard") as string,
			);
			expect(modelCard.deviceCode).toBe("ABCD-1234");
		});

		it("does nothing when device code request fails", async () => {
			provider.enable();
			mockRequestDeviceCode.mockResolvedValue(null);

			await provider.startOAuth();

			expect(mockPollForAuthorization).not.toHaveBeenCalled();
		});
	});

	describe("models()", () => {
		it("returns all Codex models", async () => {
			const models = await provider.models();
			expect(models.length).toBe(8);
			expect(models[0].id).toBe("gpt-5.4");
		});

		it("filters by search query", async () => {
			const models = await provider.models("codex");
			expect(models.every((m) => m.id.includes("codex") || m.name.toLowerCase().includes("codex"))).toBe(true);
		});

		it("puts default model first when no search", async () => {
			const models = await provider.models();
			expect(models[0].id).toBe("gpt-5.4");
		});
	});

	describe("setModel()", () => {
		it("updates selectedModelId in TinyBase", () => {
			provider.enable();
			provider.setModel("gpt-5.2");
			expect(store.getCell("aiProviders", "openai", "selectedModelId")).toBe("gpt-5.2");
		});
	});

	describe("completion()", () => {
		beforeEach(() => {
			provider.enable();
			store.setCell("aiProviders", "openai", "selectedModelId", "gpt-5.4");
		});

		it("streams tokens via onToken callback", async () => {
			const tokens: string[] = [];
			const chunks = ["Hello", " world", "!"];
			let index = 0;
			mockTextStream[Symbol.asyncIterator].mockReturnValue({
				next: jest.fn(() => {
					if (index < chunks.length) {
						return Promise.resolve({ value: chunks[index++], done: false });
					}
					return Promise.resolve({ value: undefined, done: true });
				}),
			});

			const result = await provider.completion(
				[{ role: "user", content: "Hi" }],
				(token) => tokens.push(token),
			);

			expect(tokens).toEqual(["Hello", " world", "!"]);
			expect(result.content).toBe("Hello world!");
			expect(result.finishReason).toBe("stop");
		});

		it("creates OpenAI provider with Codex baseURL and custom fetch", async () => {
			await provider.completion(
				[{ role: "user", content: "Hi" }],
				jest.fn(),
			);

			expect(mockCreateOpenAI).toHaveBeenCalledWith(
				expect.objectContaining({
					baseURL: "https://chatgpt.com/backend-api/codex",
					apiKey: "",
				}),
			);
		});

		it("uses responses() model, not chat()", async () => {
			const mockModel = {};
			mockResponses.mockReturnValue(mockModel);

			await provider.completion(
				[{ role: "user", content: "Hi" }],
				jest.fn(),
			);

			expect(mockResponses).toHaveBeenCalledWith("gpt-5.4");
			expect(mockStreamText).toHaveBeenCalledWith(
				expect.objectContaining({
					model: mockModel,
				}),
			);
		});

		it("returns error when no token", async () => {
			mockGetValidAccessToken.mockResolvedValue(null);

			const result = await provider.completion(
				[{ role: "user", content: "Hi" }],
				jest.fn(),
			);

			expect(result.finishReason).toBe("error");
			expect(result.content).toBe("");
			expect(mockStreamText).not.toHaveBeenCalled();
		});

		it("returns error when no model selected", async () => {
			store.setCell("aiProviders", "openai", "selectedModelId", "");

			const result = await provider.completion(
				[{ role: "user", content: "Hi" }],
				jest.fn(),
			);

			expect(result.finishReason).toBe("error");
		});

		it("returns cancelled on abort", async () => {
			let callCount = 0;
			mockTextStream[Symbol.asyncIterator].mockReturnValue({
				next: jest.fn(() => {
					callCount++;
					if (callCount === 1) {
						return Promise.resolve({ value: "partial", done: false });
					}
					const abortError = new Error("aborted");
					abortError.name = "AbortError";
					return Promise.reject(abortError);
				}),
			});

			const result = await provider.completion(
				[{ role: "user", content: "Hi" }],
				(token) => {
					if (token === "partial") provider.stopCompletion();
				},
			);

			expect(result.finishReason).toBe("cancelled");
			expect(result.content).toBe("partial");
		});

		it("maps length finishReason", async () => {
			mockStreamText.mockReturnValueOnce({
				textStream: mockTextStream,
				finishReason: Promise.resolve("length"),
				usage: Promise.resolve({}),
				toolCalls: Promise.resolve([]),
			});

			const result = await provider.completion(
				[{ role: "user", content: "Hi" }],
				jest.fn(),
			);

			expect(result.finishReason).toBe("length");
		});

		it("returns usage stats", async () => {
			const result = await provider.completion(
				[{ role: "user", content: "Hi" }],
				jest.fn(),
			);

			expect(result.usage).toEqual({
				promptTokens: 10,
				completionTokens: 5,
			});
		});
	});

	describe("codexFetch body patching", () => {
		beforeEach(() => {
			provider.enable();
			store.setCell("aiProviders", "openai", "selectedModelId", "gpt-5.4");
		});

		it("injects store: false and extracts instructions from developer message", async () => {
			// Capture the custom fetch function passed to createOpenAI
			let capturedFetch: Function | undefined;
			mockCreateOpenAI.mockImplementation((opts: Record<string, unknown>) => {
				capturedFetch = opts.fetch as Function;
				const p = jest.fn();
				p.responses = mockResponses;
				return p;
			});

			// Trigger completion to create the provider (which captures codexFetch)
			await provider.completion(
				[{ role: "user", content: "test" }],
				jest.fn(),
			).catch(() => {});

			expect(capturedFetch).toBeDefined();

			// Simulate a request body like the AI SDK would send
			const requestBody = JSON.stringify({
				model: "gpt-5.4",
				input: [
					{ role: "developer", content: "System instructions here" },
					{ role: "user", content: "Hello" },
				],
				stream: true,
			});

			mockExpoFetch.mockResolvedValue(new Response("ok"));

			await capturedFetch!("https://example.com/responses", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: requestBody,
			});

			const callArgs = mockExpoFetch.mock.calls[0];
			const sentBody = JSON.parse(callArgs[1].body as string);

			// store: false should be injected
			expect(sentBody.store).toBe(false);

			// developer message should be extracted to instructions
			expect(sentBody.instructions).toBe("System instructions here");

			// developer message should be removed from input
			expect(sentBody.input).toEqual([
				{ role: "user", content: "Hello" },
			]);
		});

		it("injects Codex-specific headers", async () => {
			let capturedFetch: Function | undefined;
			mockCreateOpenAI.mockImplementation((opts: Record<string, unknown>) => {
				capturedFetch = opts.fetch as Function;
				const p = jest.fn();
				p.responses = mockResponses;
				return p;
			});

			await provider.completion(
				[{ role: "user", content: "test" }],
				jest.fn(),
			).catch(() => {});

			mockExpoFetch.mockResolvedValue(new Response("ok"));

			await capturedFetch!("https://example.com/responses", {
				method: "POST",
				headers: {},
				body: "{}",
			});

			const callArgs = mockExpoFetch.mock.calls[0];
			const sentHeaders = callArgs[1].headers as Record<string, string>;

			expect(sentHeaders.authorization).toBe("Bearer test-access-token");
			expect(sentHeaders["chatgpt-account-id"]).toBe("test-account-id");
			expect(sentHeaders.originator).toBe("codex_cli_rs");
		});
	});

	describe("stopCompletion()", () => {
		it("does not throw when no active completion", () => {
			expect(() => provider.stopCompletion()).not.toThrow();
		});
	});

	describe("isConfigured()", () => {
		it("returns false when no token or model", () => {
			expect(provider.isConfigured()).toBe(false);
		});

		it("returns true after setup and model selection", async () => {
			provider.enable();
			await provider.setup();
			provider.setModel("gpt-5.4");
			expect(provider.isConfigured()).toBe(true);
		});
	});

	describe("getSystemMessage()", () => {
		it("returns system prompt with date", () => {
			const msg = provider.getSystemMessage([]);
			expect(msg).toContain("helpful");
			expect(msg).toContain("assistant");
		});
	});

	describe("getContextSize()", () => {
		it("returns model-specific context size", () => {
			provider.enable();
			provider.setModel("gpt-5.3-codex");
			expect(provider.getContextSize()).toBe(192000);
		});

		it("returns default when no model selected", () => {
			expect(provider.getContextSize()).toBe(128000);
		});
	});

	describe("getMultimodalCapabilities()", () => {
		it("returns vision for GPT-5 models", () => {
			provider.enable();
			provider.setModel("gpt-5.4");
			const caps = provider.getMultimodalCapabilities();
			expect(caps.vision).toBe(true);
			expect(caps.audio).toBe(true);
			expect(caps.files).toBe(false);
		});

		it("returns no vision when no model selected", () => {
			const caps = provider.getMultimodalCapabilities();
			expect(caps.vision).toBe(false);
			expect(caps.audio).toBe(true);
		});
	});

	describe("teardown()", () => {
		it("cancels polling and aborts", async () => {
			await provider.teardown();
			expect(mockCancelPolling).toHaveBeenCalled();
		});
	});
});
