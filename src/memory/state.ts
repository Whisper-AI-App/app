/**
 * Capability memory state machine.
 *
 * Each capability (vision, STT) has an independent 5-state lifecycle:
 *   unloaded → loading → ready → releasing → unloaded
 *   loading → budget_denied (insufficient memory)
 *   budget_denied → loading (retry)
 *
 * Replaces ad-hoc visionInitStatus, audioInitStatus, and memoryPressureTier variables.
 */

import { createLogger } from "@/src/logger";

const logger = createLogger("MemoryState");

export type CapabilityMemoryStatus =
	| "unloaded"
	| "loading"
	| "ready"
	| "releasing"
	| "budget_denied";

export interface CapabilityMemoryState {
	vision: CapabilityMemoryStatus;
	stt: CapabilityMemoryStatus;
}

export type CapabilityEvent =
	| { type: "USER_REQUEST" }
	| { type: "PRE_WARM" }
	| { type: "LOAD_SUCCESS" }
	| { type: "LOAD_FAIL_BUDGET" }
	| { type: "LOAD_FAIL_ERROR"; error: string }
	| { type: "MEMORY_PRESSURE" }
	| { type: "TEARDOWN" }
	| { type: "RELEASE_COMPLETE" }
	| { type: "RETRY" };

type CapabilityName = keyof CapabilityMemoryState;

// Valid transitions table
const TRANSITIONS: Record<CapabilityMemoryStatus, Partial<Record<CapabilityEvent["type"], CapabilityMemoryStatus>>> = {
	unloaded: {
		USER_REQUEST: "loading",
		PRE_WARM: "loading",
	},
	loading: {
		LOAD_SUCCESS: "ready",
		LOAD_FAIL_BUDGET: "budget_denied",
		LOAD_FAIL_ERROR: "unloaded",
	},
	ready: {
		MEMORY_PRESSURE: "releasing",
		TEARDOWN: "releasing",
	},
	releasing: {
		RELEASE_COMPLETE: "unloaded",
	},
	budget_denied: {
		RETRY: "loading",
	},
};

// Module-scoped state
let state: CapabilityMemoryState = {
	vision: "unloaded",
	stt: "unloaded",
};

// Listeners notified on state changes
type StateListener = (capability: CapabilityName, newStatus: CapabilityMemoryStatus) => void;
const listeners: Set<StateListener> = new Set();

/**
 * Get the current state for all capabilities.
 */
export function getCapabilityState(): Readonly<CapabilityMemoryState> {
	return { ...state };
}

/**
 * Get the status of a single capability.
 */
export function getCapabilityStatus(capability: CapabilityName): CapabilityMemoryStatus {
	return state[capability];
}

/**
 * Dispatch an event to transition a capability's state.
 * Returns the new status, or null if the transition was invalid.
 */
export function dispatch(
	capability: CapabilityName,
	event: CapabilityEvent,
): CapabilityMemoryStatus | null {
	const currentStatus = state[capability];
	const validTransitions = TRANSITIONS[currentStatus];
	const nextStatus = validTransitions[event.type];

	if (!nextStatus) {
		logger.warn("invalid transition", {
			capability,
			currentStatus,
			eventType: event.type,
		});
		return null;
	}

	state = { ...state, [capability]: nextStatus };

	for (const listener of listeners) {
		try {
			listener(capability, nextStatus);
		} catch (err) {
			logger.error("listener error", { error: String(err) });
		}
	}

	return nextStatus;
}

/**
 * Subscribe to state changes. Returns an unsubscribe function.
 */
export function subscribe(listener: StateListener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/**
 * Reset all capability states to unloaded.
 * Used during provider teardown or testing.
 */
export function resetState(): void {
	state = { vision: "unloaded", stt: "unloaded" };
}
