import { createStore } from "tinybase/with-schemas";

/**
 * In-memory session store to track the user being authenticated
 */

const sessionValuesSchema = {
	isAuthenticated: { type: "boolean" as const, default: false },
};

export const sessionStore = createStore().setValuesSchema(sessionValuesSchema);
