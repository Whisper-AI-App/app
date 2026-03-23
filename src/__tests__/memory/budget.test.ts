import { getDeviceMemoryTier, checkBudget, TIER_STRATEGIES } from "../../memory/budget";

// Mock native-memory module
jest.mock("../../utils/native-memory", () => ({
	getAvailableMemory: jest.fn(),
	getTotalMemory: jest.fn(() => 8 * 1024 * 1024 * 1024), // 8 GB
}));

// Mock expo-device
jest.mock("expo-device", () => ({
	totalMemory: 8 * 1024 * 1024 * 1024, // 8 GB
}));

const { getAvailableMemory } = require("../../utils/native-memory") as {
	getAvailableMemory: jest.Mock;
};

const GB = 1024 * 1024 * 1024;

describe("getDeviceMemoryTier", () => {
	it("returns 'minimal' for ≤3 GB", () => {
		expect(getDeviceMemoryTier(2)).toBe("minimal");
		expect(getDeviceMemoryTier(3)).toBe("minimal");
	});

	it("returns 'conservative' for 4-5 GB", () => {
		expect(getDeviceMemoryTier(4)).toBe("conservative");
		expect(getDeviceMemoryTier(5)).toBe("conservative");
	});

	it("returns 'balanced' for 6-7 GB", () => {
		expect(getDeviceMemoryTier(6)).toBe("balanced");
		expect(getDeviceMemoryTier(7)).toBe("balanced");
	});

	it("returns 'full' for 8-10 GB", () => {
		expect(getDeviceMemoryTier(8)).toBe("full");
		expect(getDeviceMemoryTier(10)).toBe("full");
	});

	it("returns 'unrestricted' for ≥12 GB", () => {
		expect(getDeviceMemoryTier(12)).toBe("unrestricted");
		expect(getDeviceMemoryTier(16)).toBe("unrestricted");
	});
});

describe("TIER_STRATEGIES", () => {
	it("sets releaseSTTAfterUse=true for minimal and conservative tiers", () => {
		expect(TIER_STRATEGIES.minimal.releaseSTTAfterUse).toBe(true);
		expect(TIER_STRATEGIES.conservative.releaseSTTAfterUse).toBe(true);
	});

	it("sets releaseSTTAfterUse=false for balanced, full, and unrestricted tiers", () => {
		expect(TIER_STRATEGIES.balanced.releaseSTTAfterUse).toBe(false);
		expect(TIER_STRATEGIES.full.releaseSTTAfterUse).toBe(false);
		expect(TIER_STRATEGIES.unrestricted.releaseSTTAfterUse).toBe(false);
	});
});

describe("checkBudget", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns canLoad=true when available > estimated * headroom (native)", async () => {
		getAvailableMemory.mockResolvedValue({
			bytes: 4 * GB,
			source: "native",
		});

		const result = await checkBudget(0.66, 0); // mmproj ~0.66 GB
		expect(result.canLoad).toBe(true);
		expect(result.source).toBe("native");
		expect(result.estimatedModelBytes).toBeGreaterThan(0);
		expect(result.availableBytes).toBe(4 * GB);
	});

	it("returns canLoad=false when available < estimated * headroom", async () => {
		getAvailableMemory.mockResolvedValue({
			bytes: 0.5 * GB, // Only 500 MB available
			source: "native",
		});

		const result = await checkBudget(2.74, 4096); // Large model
		expect(result.canLoad).toBe(false);
		expect(result.source).toBe("native");
	});

	it("reports fallback source when native module unavailable", async () => {
		getAvailableMemory.mockResolvedValue({
			bytes: 3.2 * GB,
			source: "fallback",
		});

		const result = await checkBudget(0.96, 2048);
		expect(result.source).toBe("fallback");
		expect(result.canLoad).toBe(true);
	});

	it("respects custom headroom factor", async () => {
		// With exactly 1 GB available and 0.66 GB model:
		// Default headroom 1.3: need 0.66*1.3 = 0.858 GB → passes
		// High headroom 2.0: need 0.66*2.0 = 1.32 GB → fails
		getAvailableMemory.mockResolvedValue({
			bytes: 1 * GB,
			source: "native",
		});

		const resultDefault = await checkBudget(0.66, 0, 1.3);
		expect(resultDefault.canLoad).toBe(true);

		const resultStrict = await checkBudget(0.66, 0, 2.0);
		expect(resultStrict.canLoad).toBe(false);
	});

	it("includes context size in estimation", async () => {
		getAvailableMemory.mockResolvedValue({
			bytes: 6 * GB,
			source: "native",
		});

		const smallCtx = await checkBudget(2.74, 2048);
		const largeCtx = await checkBudget(2.74, 8192);

		// Larger context = more estimated bytes
		expect(largeCtx.estimatedModelBytes).toBeGreaterThan(
			smallCtx.estimatedModelBytes,
		);
	});
});
