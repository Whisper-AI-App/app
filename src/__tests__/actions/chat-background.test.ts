import {
	mockMainStore,
	resetMockMainStore,
	seedMockMainStore,
} from "../../__mocks__/main-store-mock";

// Mock expo-file-system/legacy - use a default export pattern
const mockGetInfoAsync = jest.fn();
const mockDeleteAsync = jest.fn();
const mockCopyAsync = jest.fn();
const mockMoveAsync = jest.fn();

jest.mock("expo-file-system/legacy", () => {
	return {
		__esModule: true,
		documentDirectory: "file:///mock/documents/",
		getInfoAsync: (...args: unknown[]) => mockGetInfoAsync(...args),
		deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
		copyAsync: (...args: unknown[]) => mockCopyAsync(...args),
		moveAsync: (...args: unknown[]) => mockMoveAsync(...args),
	};
});

// Mock the store module (note: uses @/ path alias)
jest.mock("@/src/stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
}));

// Mock expo-image-picker
const mockRequestMediaLibraryPermissionsAsync = jest.fn();
const mockLaunchImageLibraryAsync = jest.fn();

jest.mock("expo-image-picker", () => ({
	requestMediaLibraryPermissionsAsync: (...args: unknown[]) =>
		mockRequestMediaLibraryPermissionsAsync(...args),
	launchImageLibraryAsync: (...args: unknown[]) =>
		mockLaunchImageLibraryAsync(...args),
}));

// Mock expo-image-manipulator
const mockSaveAsync = jest.fn();
const mockRenderAsync = jest.fn();
const mockResize = jest.fn();
const mockManipulate = jest.fn();

jest.mock("expo-image-manipulator", () => ({
	ImageManipulator: {
		manipulate: (...args: unknown[]) => mockManipulate(...args),
	},
	SaveFormat: {
		JPEG: "jpeg",
	},
}));

// Import the functions under test AFTER mocks
import {
	pickBackgroundFromLibrary,
	resetBackgroundAdjustments,
	resetToDefaultBackground,
	setBackgroundBlur,
	setBackgroundGrain,
	setBackgroundOpacity,
	setPresetBackground,
	validateCustomBackground,
} from "../../actions/chat-background";

describe("chat-background actions", () => {
	beforeEach(() => {
		resetMockMainStore();
		mockGetInfoAsync.mockReset();
		mockDeleteAsync.mockReset();
		mockCopyAsync.mockReset();
		mockMoveAsync.mockReset();
		mockRequestMediaLibraryPermissionsAsync.mockReset();
		mockLaunchImageLibraryAsync.mockReset();
		mockManipulate.mockReset();
		mockResize.mockReset();
		mockRenderAsync.mockReset();
		mockSaveAsync.mockReset();

		// Default: file doesn't exist (to avoid cleanup issues)
		mockGetInfoAsync.mockResolvedValue({ exists: false });
		mockDeleteAsync.mockResolvedValue(undefined);
		mockMoveAsync.mockResolvedValue(undefined);

		// Setup default image manipulator mock chain
		mockSaveAsync.mockResolvedValue({ uri: "file:///processed/image.jpg" });
		mockRenderAsync.mockResolvedValue({ saveAsync: mockSaveAsync });
		mockResize.mockReturnValue({ renderAsync: mockRenderAsync });
		mockManipulate.mockReturnValue({ resize: mockResize });

		jest.useFakeTimers();
		jest.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("setPresetBackground", () => {
		it("sets type to preset and presetId", () => {
			setPresetBackground("gradient-1");

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_type",
				"preset",
			);
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_uri",
				"",
			);
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_preset_id",
				"gradient-1",
			);
		});

		it("attempts to clean up old custom background when switching to preset", () => {
			seedMockMainStore({
				chat_background_type: "custom",
				chat_background_uri: "file:///mock/documents/old-bg.jpg",
			});
			mockGetInfoAsync.mockResolvedValue({ exists: true });

			setPresetBackground("gradient-2");

			// The function is called synchronously but triggers async cleanup
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_type",
				"preset",
			);
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_preset_id",
				"gradient-2",
			);
		});
	});

	describe("resetToDefaultBackground", () => {
		it("resets all background values to default none preset", () => {
			resetToDefaultBackground();

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_type",
				"preset",
			);
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_uri",
				"",
			);
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_preset_id",
				"none",
			);
		});
	});

	describe("setBackgroundBlur", () => {
		it("sets valid blur value", () => {
			setBackgroundBlur(10);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_blur",
				10,
			);
		});

		it("clamps negative values to 0", () => {
			setBackgroundBlur(-5);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_blur",
				0,
			);
		});

		it("clamps values over 20 to 20", () => {
			setBackgroundBlur(25);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_blur",
				20,
			);
		});

		it("accepts boundary value 0", () => {
			setBackgroundBlur(0);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_blur",
				0,
			);
		});

		it("accepts boundary value 20", () => {
			setBackgroundBlur(20);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_blur",
				20,
			);
		});
	});

	describe("setBackgroundGrain", () => {
		it("sets valid grain value", () => {
			setBackgroundGrain(50);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_grain",
				50,
			);
		});

		it("clamps values below 0 to 0", () => {
			setBackgroundGrain(-10);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_grain",
				0,
			);
		});

		it("clamps values over 100 to 100", () => {
			setBackgroundGrain(150);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_grain",
				100,
			);
		});
	});

	describe("setBackgroundOpacity", () => {
		it("sets valid opacity value", () => {
			setBackgroundOpacity(50);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_opacity",
				50,
			);
		});

		it("clamps values below 10 to 10", () => {
			setBackgroundOpacity(5);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_opacity",
				10,
			);
		});

		it("clamps values over 100 to 100", () => {
			setBackgroundOpacity(110);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_opacity",
				100,
			);
		});

		it("accepts boundary value 10", () => {
			setBackgroundOpacity(10);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_opacity",
				10,
			);
		});
	});

	describe("resetBackgroundAdjustments", () => {
		it("resets blur, grain, and opacity to default values", () => {
			resetBackgroundAdjustments();

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_blur",
				0,
			);
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_grain",
				0,
			);
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_opacity",
				70,
			);
		});
	});

	describe("pickBackgroundFromLibrary", () => {
		it("returns success when image is selected and saved", async () => {
			mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({
				granted: true,
			});
			mockLaunchImageLibraryAsync.mockResolvedValue({
				canceled: false,
				assets: [{ uri: "file:///picked/image.jpg" }],
			});

			const result = await pickBackgroundFromLibrary();

			expect(result.success).toBe(true);
			expect(mockMoveAsync).toHaveBeenCalled();
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_type",
				"custom",
			);
		});

		it("returns error when permission denied", async () => {
			mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({
				granted: false,
			});

			const result = await pickBackgroundFromLibrary();

			expect(result).toEqual({
				success: false,
				error: "Permission to access photos was denied",
			});
		});

		it("returns success false with no error when user cancels", async () => {
			mockRequestMediaLibraryPermissionsAsync.mockResolvedValue({
				granted: true,
			});
			mockLaunchImageLibraryAsync.mockResolvedValue({
				canceled: true,
			});

			const result = await pickBackgroundFromLibrary();

			expect(result).toEqual({ success: false });
		});
	});

	describe("validateCustomBackground", () => {
		it("returns true for existing custom background file", async () => {
			seedMockMainStore({
				chat_background_type: "custom",
				chat_background_uri: "file:///mock/documents/bg.jpg",
			});
			mockGetInfoAsync.mockResolvedValue({ exists: true });

			const result = await validateCustomBackground();

			expect(result).toBe(true);
		});

		it("returns true for non-custom backgrounds (no validation needed)", async () => {
			seedMockMainStore({
				chat_background_type: "preset",
				chat_background_uri: "",
			});

			const result = await validateCustomBackground();

			expect(result).toBe(true);
			expect(mockGetInfoAsync).not.toHaveBeenCalled();
		});

		it("resets to default and returns false for missing custom background file", async () => {
			seedMockMainStore({
				chat_background_type: "custom",
				chat_background_uri: "file:///mock/documents/missing.jpg",
			});
			mockGetInfoAsync.mockResolvedValue({ exists: false });

			const result = await validateCustomBackground();

			expect(result).toBe(false);
			// resetToDefaultBackground should have been called
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"chat_background_preset_id",
				"none",
			);
		});

		it("resets to default and returns false on file system error", async () => {
			seedMockMainStore({
				chat_background_type: "custom",
				chat_background_uri: "file:///mock/documents/error.jpg",
			});
			mockGetInfoAsync.mockRejectedValue(new Error("File system error"));

			const result = await validateCustomBackground();

			expect(result).toBe(false);
		});
	});
});
