import {
	getPerformanceBadge,
	type PerformanceTier,
} from "@/src/ai-providers/huggingface/performance-badge";

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

describe("getPerformanceBadge", () => {
	// ─── Tier Classification ────────────────────────────────────

	describe("tier classification with clear values", () => {
		it('returns "Very Well" when ratio >= 6.0', () => {
			// 12 GB RAM / 1 GB file = ratio 12.0
			expect(getPerformanceBadge(12 * GB, 1 * GB)).toBe("Very Well");
		});

		it('returns "Well" when ratio >= 4.0 and < 6.0', () => {
			// 8 GB RAM / 2 GB file = ratio 4.0 (boundary), but let's use a clear mid-range value
			// 10 GB RAM / 2 GB file = ratio 5.0
			expect(getPerformanceBadge(10 * GB, 2 * GB)).toBe("Well");
		});

		it('returns "Okay" when ratio >= 2.5 and < 4.0', () => {
			// 6 GB RAM / 2 GB file = ratio 3.0
			expect(getPerformanceBadge(6 * GB, 2 * GB)).toBe("Okay");
		});

		it('returns "Poorly" when ratio >= 1.5 and < 2.5', () => {
			// 3 GB RAM / 1.5 GB file = ratio 2.0
			expect(getPerformanceBadge(3 * GB, 1.5 * GB)).toBe("Poorly");
		});

		it('returns "Badly" when ratio < 1.5', () => {
			// 2 GB RAM / 2 GB file = ratio 1.0
			expect(getPerformanceBadge(2 * GB, 2 * GB)).toBe("Badly");
		});
	});

	// ─── Exact Boundary Values ──────────────────────────────────

	describe("exact boundary values", () => {
		it('returns "Very Well" at ratio = exactly 6.0', () => {
			// 6 GB RAM / 1 GB file = ratio 6.0
			expect(getPerformanceBadge(6 * GB, 1 * GB)).toBe("Very Well");
		});

		it('returns "Well" at ratio just below 6.0', () => {
			// Use values that produce ratio slightly under 6.0
			// 5.99 GB RAM / 1 GB file ~ 5.99
			const ram = 5.99 * GB;
			const file = 1 * GB;
			expect(getPerformanceBadge(ram, file)).toBe("Well");
		});

		it('returns "Well" at ratio = exactly 4.0', () => {
			// 4 GB RAM / 1 GB file = ratio 4.0
			expect(getPerformanceBadge(4 * GB, 1 * GB)).toBe("Well");
		});

		it('returns "Okay" at ratio just below 4.0', () => {
			// 3.99 GB RAM / 1 GB file ~ 3.99
			const ram = 3.99 * GB;
			const file = 1 * GB;
			expect(getPerformanceBadge(ram, file)).toBe("Okay");
		});

		it('returns "Okay" at ratio = exactly 2.5', () => {
			// 2.5 GB RAM / 1 GB file = ratio 2.5
			expect(getPerformanceBadge(2.5 * GB, 1 * GB)).toBe("Okay");
		});

		it('returns "Poorly" at ratio just below 2.5', () => {
			// 2.49 GB RAM / 1 GB file ~ 2.49
			const ram = 2.49 * GB;
			const file = 1 * GB;
			expect(getPerformanceBadge(ram, file)).toBe("Poorly");
		});

		it('returns "Poorly" at ratio = exactly 1.5', () => {
			// 1.5 GB RAM / 1 GB file = ratio 1.5
			expect(getPerformanceBadge(1.5 * GB, 1 * GB)).toBe("Poorly");
		});

		it('returns "Badly" at ratio just below 1.5', () => {
			// 1.49 GB RAM / 1 GB file ~ 1.49
			const ram = 1.49 * GB;
			const file = 1 * GB;
			expect(getPerformanceBadge(ram, file)).toBe("Badly");
		});
	});

	// ─── Very Small Files with Large RAM ────────────────────────

	describe("very small files with very large RAM", () => {
		it('returns "Very Well" for a tiny file on a high-RAM device', () => {
			// 16 GB RAM / 100 MB file = ratio 160
			expect(getPerformanceBadge(16 * GB, 100 * MB)).toBe("Very Well");
		});

		it('returns "Very Well" for a 1 MB file on a 4 GB device', () => {
			// 4 GB / 1 MB = ratio 4096
			expect(getPerformanceBadge(4 * GB, 1 * MB)).toBe("Very Well");
		});

		it('returns "Very Well" for a 10 KB file', () => {
			// 8 GB / 10 KB = enormous ratio
			expect(getPerformanceBadge(8 * GB, 10 * 1024)).toBe("Very Well");
		});
	});

	// ─── Equal RAM and File Size ────────────────────────────────

	describe("equal RAM and file size", () => {
		it('returns "Badly" when RAM equals file size (ratio = 1.0)', () => {
			expect(getPerformanceBadge(4 * GB, 4 * GB)).toBe("Badly");
		});

		it('returns "Badly" when both are small and equal', () => {
			expect(getPerformanceBadge(512 * MB, 512 * MB)).toBe("Badly");
		});

		it('returns "Badly" when both are large and equal', () => {
			expect(getPerformanceBadge(32 * GB, 32 * GB)).toBe("Badly");
		});
	});

	// ─── File Size Larger Than RAM ──────────────────────────────

	describe("file size larger than RAM", () => {
		it('returns "Badly" when file is twice the RAM', () => {
			// 2 GB RAM / 4 GB file = ratio 0.5
			expect(getPerformanceBadge(2 * GB, 4 * GB)).toBe("Badly");
		});

		it('returns "Badly" when file is much larger than RAM', () => {
			// 1 GB RAM / 16 GB file = ratio 0.0625
			expect(getPerformanceBadge(1 * GB, 16 * GB)).toBe("Badly");
		});

		it('returns "Badly" when file is slightly larger than RAM', () => {
			// 4 GB RAM / 5 GB file = ratio 0.8
			expect(getPerformanceBadge(4 * GB, 5 * GB)).toBe("Badly");
		});
	});

	// ─── Realistic Device Scenarios ─────────────────────────────

	describe("realistic device scenarios", () => {
		it('iPhone with 6 GB RAM running a 1.2 GB model returns "Well"', () => {
			// 6 GB / 1.2 GB = ratio 5.0
			expect(getPerformanceBadge(6 * GB, 1.2 * GB)).toBe("Well");
		});

		it('iPhone with 8 GB RAM running a 4.5 GB model returns "Poorly"', () => {
			// 8 GB / 4.5 GB = ratio ~1.78
			expect(getPerformanceBadge(8 * GB, 4.5 * GB)).toBe("Poorly");
		});

		it('iPad with 16 GB RAM running a 4 GB model returns "Well"', () => {
			// 16 GB / 4 GB = ratio 4.0
			expect(getPerformanceBadge(16 * GB, 4 * GB)).toBe("Well");
		});

		it('low-end device with 3 GB RAM running a 2.5 GB model returns "Badly"', () => {
			// 3 GB / 2.5 GB = ratio 1.2
			expect(getPerformanceBadge(3 * GB, 2.5 * GB)).toBe("Badly");
		});

		it('high-end device with 12 GB RAM running a 0.4 GB model returns "Very Well"', () => {
			// 12 GB / 0.4 GB = ratio 30
			expect(getPerformanceBadge(12 * GB, 0.4 * GB)).toBe("Very Well");
		});
	});

	// ─── Return Type ────────────────────────────────────────────

	describe("return type", () => {
		it("returns a valid PerformanceTier string", () => {
			const validTiers: PerformanceTier[] = [
				"Very Well",
				"Well",
				"Okay",
				"Poorly",
				"Badly",
			];
			const result = getPerformanceBadge(8 * GB, 2 * GB);
			expect(validTiers).toContain(result);
		});
	});
});
