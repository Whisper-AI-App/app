import {
	mockMainStore,
	resetMockMainStore,
	seedMockMainStore,
} from "../../__mocks__/main-store-mock";

// Mock the store module
jest.mock("../../stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
}));

// Mock expo-alternate-app-icons
const mockSetAlternateAppIcon = jest.fn();
const mockGetAppIconName = jest.fn();
const mockResetAlternateAppIcon = jest.fn();

jest.mock("expo-alternate-app-icons", () => ({
	setAlternateAppIcon: (...args: unknown[]) =>
		mockSetAlternateAppIcon(...args),
	getAppIconName: (...args: unknown[]) => mockGetAppIconName(...args),
	resetAppIcon: (...args: unknown[]) => mockResetAlternateAppIcon(...args),
}));

// Import the functions under test AFTER mocks
import {
	setAppIconVariant,
	resetAppIcon,
	getSelectedIconVariant,
} from "../../actions/app-icon";

describe("app-icon actions", () => {
	beforeEach(() => {
		resetMockMainStore();
		mockSetAlternateAppIcon.mockReset();
		mockGetAppIconName.mockReset();
		mockResetAlternateAppIcon.mockReset();
	});

	describe("setAppIconVariant", () => {
		it("sets a non-default icon variant using setAlternateAppIcon", async () => {
			mockSetAlternateAppIcon.mockResolvedValue(undefined);

			const result = await setAppIconVariant("BlackAndWhite");

			expect(result).toEqual({ success: true });
			expect(mockSetAlternateAppIcon).toHaveBeenCalledWith(
				"BlackAndWhite",
			);
			expect(mockResetAlternateAppIcon).not.toHaveBeenCalled();
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"app_icon_variant",
				"BlackAndWhite",
			);
		});

		it("resets the app icon when variant is Default", async () => {
			mockResetAlternateAppIcon.mockResolvedValue(undefined);

			const result = await setAppIconVariant("Default");

			expect(result).toEqual({ success: true });
			expect(mockResetAlternateAppIcon).toHaveBeenCalled();
			expect(mockSetAlternateAppIcon).not.toHaveBeenCalled();
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"app_icon_variant",
				"Default",
			);
		});

		it("stores the variant in the main store on success", async () => {
			mockSetAlternateAppIcon.mockResolvedValue(undefined);

			await setAppIconVariant("Green");

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"app_icon_variant",
				"Green",
			);
		});

		it("returns error when setAlternateAppIcon throws", async () => {
			mockSetAlternateAppIcon.mockRejectedValue(
				new Error("Icon not found"),
			);

			const result = await setAppIconVariant("DarkBlue");

			expect(result).toEqual({
				success: false,
				error: "Icon not found",
			});
			expect(mockMainStore.setValue).not.toHaveBeenCalled();
		});

		it("returns error when resetAppIcon throws for Default variant", async () => {
			mockResetAlternateAppIcon.mockRejectedValue(
				new Error("Reset failed"),
			);

			const result = await setAppIconVariant("Default");

			expect(result).toEqual({
				success: false,
				error: "Reset failed",
			});
			expect(mockMainStore.setValue).not.toHaveBeenCalled();
		});

		it("returns 'Unknown error' for non-Error thrown values", async () => {
			mockSetAlternateAppIcon.mockRejectedValue("string error");

			const result = await setAppIconVariant("Green");

			expect(result).toEqual({
				success: false,
				error: "Unknown error",
			});
		});
	});

	describe("resetAppIcon", () => {
		it("calls setAppIconVariant with Default", async () => {
			mockResetAlternateAppIcon.mockResolvedValue(undefined);

			const result = await resetAppIcon();

			expect(result).toEqual({ success: true });
			expect(mockResetAlternateAppIcon).toHaveBeenCalled();
			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"app_icon_variant",
				"Default",
			);
		});

		it("propagates errors from setAppIconVariant", async () => {
			mockResetAlternateAppIcon.mockRejectedValue(
				new Error("Reset failed"),
			);

			const result = await resetAppIcon();

			expect(result).toEqual({
				success: false,
				error: "Reset failed",
			});
		});
	});

	describe("getSelectedIconVariant", () => {
		it("returns stored variant from the store", () => {
			seedMockMainStore({ app_icon_variant: "Green" });

			const result = getSelectedIconVariant();

			expect(result).toBe("Green");
		});

		it("returns Default when no variant is stored", () => {
			// No values seeded

			const result = getSelectedIconVariant();

			expect(result).toBe("Default");
		});

		it("returns Default when stored value is undefined", () => {
			seedMockMainStore({ app_icon_variant: undefined });

			const result = getSelectedIconVariant();

			expect(result).toBe("Default");
		});
	});
});
