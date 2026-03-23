import { estimateModelRAM } from "../../memory/estimator";

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

describe("estimateModelRAM", () => {
	it("estimates RAM for a small model (0.96GB, 2048 ctx)", () => {
		const result = estimateModelRAM(0.96, 2048);
		// weights: 0.96 GB + KV cache: 100 MB + buffers: 50 MB
		const expected = 0.96 * GB + 100 * MB + 50 * MB;
		expect(result).toBe(expected);
	});

	it("estimates RAM for a medium model (2.74GB, 4096 ctx)", () => {
		const result = estimateModelRAM(2.74, 4096);
		// weights: 2.74 GB + KV cache: (4096/2048)*100 = 200 MB + buffers: 50 MB
		const expected = 2.74 * GB + 200 * MB + 50 * MB;
		expect(result).toBe(expected);
	});

	it("estimates RAM for a large model (4GB, 8192 ctx)", () => {
		const result = estimateModelRAM(4, 8192);
		// weights: 4 GB + KV cache: (8192/2048)*100 = 400 MB + buffers: 50 MB
		const expected = 4 * GB + 400 * MB + 50 * MB;
		expect(result).toBe(expected);
	});

	it("handles zero context size (e.g., mmproj with no context window)", () => {
		const result = estimateModelRAM(0.66, 0);
		// weights: 0.66 GB + KV cache: 0 + buffers: 50 MB
		const expected = 0.66 * GB + 0 + 50 * MB;
		expect(result).toBe(expected);
	});

	it("returns a positive number for any valid input", () => {
		expect(estimateModelRAM(0.1, 512)).toBeGreaterThan(0);
	});
});
