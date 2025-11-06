import { store } from "../store";

export function setName(value: string) {
	store.setValue("name", value);
}

export function completeOnboarding(value: boolean = true) {
	if (value === false) {
		store.delValue("onboardedAt");
		return;
	}

	store.setValue("onboardedAt", new Date().toISOString());
}
