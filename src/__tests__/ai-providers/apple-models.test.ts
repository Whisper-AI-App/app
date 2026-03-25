import { createStore } from "tinybase";
import type { Store } from "tinybase";

// Mock @react-native-ai/apple
const mockIsAvailable = jest.fn(() => true);
const mockAppleModel = jest.fn();
jest.mock("@react-native-ai/apple", () => ({
	apple: Object.assign(mockAppleModel, {
		isAvailable: mockIsAvailable,
	}),
}));

// Mock ai package streamText
const mockTextStream = {
	[Symbol.asyncIterator]: jest.fn(),
};
const mockStreamTextResult = {
	textStream: mockTextStream,
	// Default: resolves to a successful result with finishReason "stop"
	// biome-ignore lint/suspicious/noThenProperty: mock must be thenable to simulate streamText's promise-like return
	then: (resolve: (v: unknown) => void) =>
		resolve({ finishReason: "stop", usage: {} }),
};
jest.mock("ai", () => ({
	streamText: jest.fn(() => mockStreamTextResult),
}));

// Mock react-native Platform
jest.mock("react-native", () => ({
	Platform: { OS: "ios" },
}));

// Mock message-converter
jest.mock("../../ai-providers/message-converter", () => ({
	convertMessagesForAISDK: jest.fn(async (messages: unknown[]) => messages),
}));

// Must import after mocks
import { createAppleModelsProvider } from "../../ai-providers/apple-models/provider";
import { streamText } from "ai";

describe("Apple Models Provider", () => {
	let store: Store;
	let provider: ReturnType<typeof createAppleModelsProvider>;

	beforeEach(() => {
		jest.clearAllMocks();
		store = createStore();
		provider = createAppleModelsProvider(store);
		mockIsAvailable.mockReturnValue(true);
	});

	describe("identity", () => {
		it("has correct provider metadata", () => {
			expect(provider.id).toBe("apple-models");
			expect(provider.name).toBe("Apple Intelligence");
			expect(provider.type).toBe("local");
			expect(provider.defaultModelId).toBe("system-default");
			expect(provider.capabilities).toEqual({
				oauth: false,
				download: false,
				userApiKey: false,
			});
		});
	});

	describe("enable()", () => {
		it("creates TinyBase row with needs_setup status", () => {
			provider.enable();
			const row = store.getRow("aiProviders", "apple-models");
			expect(row).toBeDefined();
			expect(row.id).toBe("apple-models");
			expect(row.status).toBe("needs_setup");
			expect(row.error).toBe("");
			expect(row.selectedModelId).toBe("");
		});
	});

	describe("disable()", () => {
		it("deletes TinyBase row", async () => {
			provider.enable();
			expect(store.getRow("aiProviders", "apple-models")).toBeDefined();

			await provider.disable();
			expect(store.getRow("aiProviders", "apple-models")).toEqual({});
		});

		it("aborts active completion before deleting row", async () => {
			provider.enable();
			await provider.disable();
			expect(store.getRow("aiProviders", "apple-models")).toEqual({});
		});
	});

	describe("setup()", () => {
		it("transitions to ready on success", async () => {
			provider.enable();
			await provider.setup();

			expect(store.getCell("aiProviders", "apple-models", "status")).toBe(
				"ready",
			);
			expect(store.getCell("aiProviders", "apple-models", "error")).toBe("");
			expect(
				store.getCell("aiProviders", "apple-models", "selectedModelId"),
			).toBe("system-default");
		});

		it("transitions to error when not available", async () => {
			provider.enable();
			mockIsAvailable.mockReturnValue(false);

			await provider.setup();

			expect(store.getCell("aiProviders", "apple-models", "status")).toBe(
				"error",
			);
			expect(store.getCell("aiProviders", "apple-models", "error")).toContain(
				"not available",
			);
		});
	});

	describe("models()", () => {
		it("returns single system-default model", async () => {
			const models = await provider.models();
			expect(models).toEqual([
				{
					id: "system-default",
					name: "Apple Intelligence",
					description: "Apple's on-device foundation model",
					contextLength: 4096,
				},
			]);
		});
	});

	describe("setModel()", () => {
		it("updates selectedModelId in TinyBase", () => {
			provider.enable();
			provider.setModel("system-default");
			expect(
				store.getCell("aiProviders", "apple-models", "selectedModelId"),
			).toBe("system-default");
		});
	});

	describe("completion()", () => {
		it("streams tokens via onToken callback", async () => {
			const tokens: string[] = [];
			const onToken = (token: string) => tokens.push(token);

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
				onToken,
			);

			expect(tokens).toEqual(["Hello", " world", "!"]);
			expect(result.content).toBe("Hello world!");
			expect(result.finishReason).toBe("stop");
			expect(streamText).toHaveBeenCalledWith(
				expect.objectContaining({
					system: expect.stringContaining("Whisper"),
					abortSignal: expect.any(AbortSignal),
				}),
			);
		});

		it("returns cancelled on abort", async () => {
			const tokens: string[] = [];
			const onToken = (token: string) => tokens.push(token);

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

			const completionPromise = provider.completion(
				[{ role: "user", content: "Hi" }],
				(token) => {
					onToken(token);
					provider.stopCompletion();
				},
			);

			const result = await completionPromise;
			expect(result.finishReason).toBe("cancelled");
			expect(result.content).toBe("partial");
		});

		it("returns error when isAvailable is false before completion", async () => {
			const tokens: string[] = [];
			mockIsAvailable.mockReturnValue(false);

			const result = await provider.completion(
				[{ role: "user", content: "Hi" }],
				(token) => tokens.push(token),
			);

			expect(result.finishReason).toBe("error");
			expect(result.content).toContain("not available");
			expect(tokens.length).toBe(1);
			expect(streamText).not.toHaveBeenCalled();
		});

		it("returns error on thrown GenerationError", async () => {
			const tokens: string[] = [];

			(streamText as jest.Mock).mockImplementationOnce(() => {
				throw new Error(
					"The operation couldn't be completed. (FoundationModels.LanguageModelSession.GenerationError error -1.)",
				);
			});

			const result = await provider.completion(
				[{ role: "user", content: "Hi" }],
				(token) => tokens.push(token),
			);

			expect(result.finishReason).toBe("error");
			expect(result.content).toContain("Apple Intelligence could not generate");
			expect(tokens.length).toBe(1);
		});

		it("returns error when stream completes with error finishReason", async () => {
			const tokens: string[] = [];

			// Stream yields nothing, then ends
			mockTextStream[Symbol.asyncIterator].mockReturnValue({
				next: jest.fn(() =>
					Promise.resolve({ value: undefined, done: true }),
				),
			});

			// AI SDK result resolves with finishReason "error"
			(streamText as jest.Mock).mockImplementationOnce(() => ({
				textStream: mockTextStream,
				// biome-ignore lint/suspicious/noThenProperty: mock must be thenable to simulate streamText's promise-like return
				then: (resolve: (v: unknown) => void) =>
					resolve({ finishReason: "error", usage: {} }),
			}));

			const result = await provider.completion(
				[{ role: "user", content: "Hi" }],
				(token) => tokens.push(token),
			);

			expect(result.finishReason).toBe("error");
			expect(result.content).toContain("Apple Intelligence could not generate");
		});
	});

	describe("stopCompletion()", () => {
		it("does not throw when no active completion", () => {
			expect(() => provider.stopCompletion()).not.toThrow();
		});
	});

	describe("isConfigured()", () => {
		it("returns false when not setup", () => {
			expect(provider.isConfigured()).toBe(false);
		});

		it("returns true when status is ready", () => {
			provider.enable();
			store.setCell("aiProviders", "apple-models", "status", "ready");
			expect(provider.isConfigured()).toBe(true);
		});
	});

	describe("getSystemMessage()", () => {
		it("returns Whisper system prompt", () => {
			const msg = provider.getSystemMessage([]);
			expect(msg).toContain("Whisper");
			expect(msg).toContain("private");
			expect(msg).toContain("on-device");
		});
	});

	describe("getContextSize()", () => {
		it("returns 4096", () => {
			expect(provider.getContextSize()).toBe(4096);
		});
	});

	describe("getMultimodalCapabilities()", () => {
		it("returns NO_MULTIMODAL", () => {
			const caps = provider.getMultimodalCapabilities();
			expect(caps.vision).toBe(false);
			expect(caps.audio).toBe(false);
			expect(caps.files).toBe(false);
		});
	});

	describe("teardown()", () => {
		it("completes without error", async () => {
			await expect(provider.teardown()).resolves.toBeUndefined();
		});
	});
});

describe("Apple Models Registry", () => {
	it("registers factory only on iOS when available", () => {
		const { Platform } = require("react-native");
		const { apple } = require("@react-native-ai/apple");

		expect(Platform.OS).toBe("ios");
		expect(apple.isAvailable()).toBe(true);
	});
});
