import {
	dispatch,
	getCapabilityState,
	getCapabilityStatus,
	resetState,
	subscribe,
} from "../../memory/state";

describe("CapabilityMemoryState", () => {
	beforeEach(() => {
		resetState();
	});

	describe("initial state", () => {
		it("starts with all capabilities unloaded", () => {
			const state = getCapabilityState();
			expect(state.vision).toBe("unloaded");
			expect(state.stt).toBe("unloaded");
		});
	});

	describe("valid transitions", () => {
		it("unloaded → loading via USER_REQUEST", () => {
			const result = dispatch("vision", { type: "USER_REQUEST" });
			expect(result).toBe("loading");
			expect(getCapabilityStatus("vision")).toBe("loading");
		});

		it("unloaded → loading via PRE_WARM", () => {
			const result = dispatch("stt", { type: "PRE_WARM" });
			expect(result).toBe("loading");
			expect(getCapabilityStatus("stt")).toBe("loading");
		});

		it("loading → ready via LOAD_SUCCESS", () => {
			dispatch("vision", { type: "USER_REQUEST" });
			const result = dispatch("vision", { type: "LOAD_SUCCESS" });
			expect(result).toBe("ready");
			expect(getCapabilityStatus("vision")).toBe("ready");
		});

		it("loading → budget_denied via LOAD_FAIL_BUDGET", () => {
			dispatch("stt", { type: "USER_REQUEST" });
			const result = dispatch("stt", { type: "LOAD_FAIL_BUDGET" });
			expect(result).toBe("budget_denied");
			expect(getCapabilityStatus("stt")).toBe("budget_denied");
		});

		it("loading → unloaded via LOAD_FAIL_ERROR", () => {
			dispatch("vision", { type: "USER_REQUEST" });
			const result = dispatch("vision", {
				type: "LOAD_FAIL_ERROR",
				error: "test error",
			});
			expect(result).toBe("unloaded");
			expect(getCapabilityStatus("vision")).toBe("unloaded");
		});

		it("ready → releasing via MEMORY_PRESSURE", () => {
			dispatch("stt", { type: "USER_REQUEST" });
			dispatch("stt", { type: "LOAD_SUCCESS" });
			const result = dispatch("stt", { type: "MEMORY_PRESSURE" });
			expect(result).toBe("releasing");
		});

		it("ready → releasing via TEARDOWN", () => {
			dispatch("vision", { type: "USER_REQUEST" });
			dispatch("vision", { type: "LOAD_SUCCESS" });
			const result = dispatch("vision", { type: "TEARDOWN" });
			expect(result).toBe("releasing");
		});

		it("releasing → unloaded via RELEASE_COMPLETE", () => {
			dispatch("stt", { type: "USER_REQUEST" });
			dispatch("stt", { type: "LOAD_SUCCESS" });
			dispatch("stt", { type: "MEMORY_PRESSURE" });
			const result = dispatch("stt", { type: "RELEASE_COMPLETE" });
			expect(result).toBe("unloaded");
			expect(getCapabilityStatus("stt")).toBe("unloaded");
		});

		it("budget_denied → loading via RETRY", () => {
			dispatch("vision", { type: "USER_REQUEST" });
			dispatch("vision", { type: "LOAD_FAIL_BUDGET" });
			const result = dispatch("vision", { type: "RETRY" });
			expect(result).toBe("loading");
		});
	});

	describe("invalid transitions", () => {
		it("returns null for invalid transition from unloaded", () => {
			const result = dispatch("vision", { type: "LOAD_SUCCESS" });
			expect(result).toBeNull();
			expect(getCapabilityStatus("vision")).toBe("unloaded");
		});

		it("returns null for MEMORY_PRESSURE when unloaded", () => {
			const result = dispatch("stt", { type: "MEMORY_PRESSURE" });
			expect(result).toBeNull();
		});

		it("returns null for USER_REQUEST when ready", () => {
			dispatch("vision", { type: "USER_REQUEST" });
			dispatch("vision", { type: "LOAD_SUCCESS" });
			const result = dispatch("vision", { type: "USER_REQUEST" });
			expect(result).toBeNull();
		});

		it("returns null for RETRY when not budget_denied", () => {
			const result = dispatch("stt", { type: "RETRY" });
			expect(result).toBeNull();
		});
	});

	describe("independent tracking", () => {
		it("vision and stt states are independent", () => {
			dispatch("vision", { type: "USER_REQUEST" });
			dispatch("vision", { type: "LOAD_SUCCESS" });

			expect(getCapabilityStatus("vision")).toBe("ready");
			expect(getCapabilityStatus("stt")).toBe("unloaded");

			dispatch("stt", { type: "PRE_WARM" });
			expect(getCapabilityStatus("vision")).toBe("ready");
			expect(getCapabilityStatus("stt")).toBe("loading");
		});
	});

	describe("subscribe", () => {
		it("notifies listeners on state change", () => {
			const events: Array<{ capability: string; status: string }> = [];
			const unsub = subscribe((capability, status) => {
				events.push({ capability, status });
			});

			dispatch("vision", { type: "USER_REQUEST" });
			dispatch("vision", { type: "LOAD_SUCCESS" });

			expect(events).toHaveLength(2);
			expect(events[0]).toEqual({ capability: "vision", status: "loading" });
			expect(events[1]).toEqual({ capability: "vision", status: "ready" });

			unsub();
		});

		it("does not notify after unsubscribe", () => {
			const events: string[] = [];
			const unsub = subscribe((_cap, status) => events.push(status));

			dispatch("stt", { type: "USER_REQUEST" });
			unsub();
			dispatch("stt", { type: "LOAD_SUCCESS" });

			expect(events).toHaveLength(1);
		});
	});

	describe("resetState", () => {
		it("resets all capabilities to unloaded", () => {
			dispatch("vision", { type: "USER_REQUEST" });
			dispatch("vision", { type: "LOAD_SUCCESS" });
			dispatch("stt", { type: "USER_REQUEST" });

			resetState();

			expect(getCapabilityStatus("vision")).toBe("unloaded");
			expect(getCapabilityStatus("stt")).toBe("unloaded");
		});
	});
});
