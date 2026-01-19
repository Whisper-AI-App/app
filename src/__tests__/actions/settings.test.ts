import {
	mockMainStore,
	resetMockMainStore,
} from "../../__mocks__/main-store-mock";

// Mock the store module
jest.mock("../../stores/main/main-store", () => ({
	mainStore: require("../../__mocks__/main-store-mock").mockMainStore,
}));

// Mock expo-local-authentication
const mockHasHardwareAsync = jest.fn();
const mockIsEnrolledAsync = jest.fn();
const mockAuthenticateAsync = jest.fn();

jest.mock("expo-local-authentication", () => ({
	hasHardwareAsync: (...args: unknown[]) => mockHasHardwareAsync(...args),
	isEnrolledAsync: (...args: unknown[]) => mockIsEnrolledAsync(...args),
	authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
}));

// Import the functions under test AFTER mocks
import {
	authenticate,
	checkLocalAuthAvailable,
	completeOnboarding,
	setLocalAuth,
	setName,
} from "../../actions/settings";

describe("settings actions", () => {
	beforeEach(() => {
		resetMockMainStore();
		mockHasHardwareAsync.mockReset();
		mockIsEnrolledAsync.mockReset();
		mockAuthenticateAsync.mockReset();
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2024-01-15T10:30:00.000Z"));
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	describe("setName", () => {
		it("sets name value in store", () => {
			setName("John Doe");

			expect(mockMainStore.setValue).toHaveBeenCalledWith("name", "John Doe");
		});

		it("can set empty name", () => {
			setName("");

			expect(mockMainStore.setValue).toHaveBeenCalledWith("name", "");
		});
	});

	describe("completeOnboarding", () => {
		it("sets onboardedAt timestamp when called with true", () => {
			completeOnboarding(true);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"onboardedAt",
				"2024-01-15T10:30:00.000Z",
			);
		});

		it("sets onboardedAt timestamp when called without argument (default true)", () => {
			completeOnboarding();

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"onboardedAt",
				"2024-01-15T10:30:00.000Z",
			);
		});

		it("clears onboardedAt when called with false", () => {
			completeOnboarding(false);

			expect(mockMainStore.delValue).toHaveBeenCalledWith("onboardedAt");
			expect(mockMainStore.setValue).not.toHaveBeenCalled();
		});
	});

	describe("setLocalAuth", () => {
		it("enables local auth when passed true", () => {
			setLocalAuth(true);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"localAuthEnabled",
				true,
			);
		});

		it("disables local auth when passed false", () => {
			setLocalAuth(false);

			expect(mockMainStore.setValue).toHaveBeenCalledWith(
				"localAuthEnabled",
				false,
			);
		});
	});

	describe("checkLocalAuthAvailable", () => {
		it("returns available: true when hardware exists and biometrics enrolled", async () => {
			mockHasHardwareAsync.mockResolvedValue(true);
			mockIsEnrolledAsync.mockResolvedValue(true);

			const result = await checkLocalAuthAvailable();

			expect(result).toEqual({
				hasHardware: true,
				isEnrolled: true,
				available: true,
			});
		});

		it("returns available: false when no hardware", async () => {
			mockHasHardwareAsync.mockResolvedValue(false);
			mockIsEnrolledAsync.mockResolvedValue(true);

			const result = await checkLocalAuthAvailable();

			expect(result).toEqual({
				hasHardware: false,
				isEnrolled: true,
				available: false,
			});
		});

		it("returns available: false when not enrolled", async () => {
			mockHasHardwareAsync.mockResolvedValue(true);
			mockIsEnrolledAsync.mockResolvedValue(false);

			const result = await checkLocalAuthAvailable();

			expect(result).toEqual({
				hasHardware: true,
				isEnrolled: false,
				available: false,
			});
		});

		it("returns available: false when neither hardware nor enrolled", async () => {
			mockHasHardwareAsync.mockResolvedValue(false);
			mockIsEnrolledAsync.mockResolvedValue(false);

			const result = await checkLocalAuthAvailable();

			expect(result).toEqual({
				hasHardware: false,
				isEnrolled: false,
				available: false,
			});
		});
	});

	describe("authenticate", () => {
		it("returns success: true on successful authentication", async () => {
			mockAuthenticateAsync.mockResolvedValue({ success: true });

			const result = await authenticate();

			expect(result).toEqual({ success: true });
			expect(mockAuthenticateAsync).toHaveBeenCalledWith({
				promptMessage: "Unlock Whisper",
				disableDeviceFallback: false,
				cancelLabel: "Cancel",
			});
		});

		it("returns cancelled error when user cancels", async () => {
			mockAuthenticateAsync.mockResolvedValue({
				success: false,
				error: "user_cancel",
			});

			const result = await authenticate();

			expect(result).toEqual({
				success: false,
				error: "Authentication cancelled",
			});
		});

		it("returns lockout error on too many attempts", async () => {
			mockAuthenticateAsync.mockResolvedValue({
				success: false,
				error: "lockout",
			});

			const result = await authenticate();

			expect(result).toEqual({
				success: false,
				error: "Too many failed attempts. Please try again later",
			});
		});

		it("returns permanent lockout error", async () => {
			mockAuthenticateAsync.mockResolvedValue({
				success: false,
				error: "lockout_permanent",
			});

			const result = await authenticate();

			expect(result).toEqual({
				success: false,
				error: "Biometrics disabled. Use your device passcode",
			});
		});

		it("returns not enrolled error", async () => {
			mockAuthenticateAsync.mockResolvedValue({
				success: false,
				error: "not_enrolled",
			});

			const result = await authenticate();

			expect(result).toEqual({
				success: false,
				error: "No biometrics enrolled on this device",
			});
		});

		it("returns default error for unknown error codes", async () => {
			mockAuthenticateAsync.mockResolvedValue({
				success: false,
				error: "unknown_error_code",
			});

			const result = await authenticate();

			expect(result).toEqual({
				success: false,
				error: "Authentication failed. Please try again",
			});
		});

		it("returns default error when no error code provided", async () => {
			mockAuthenticateAsync.mockResolvedValue({
				success: false,
				error: undefined,
			});

			const result = await authenticate();

			expect(result).toEqual({
				success: false,
				error: "Authentication failed. Please try again",
			});
		});
	});
});
