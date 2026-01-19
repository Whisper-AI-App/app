import { useColorScheme } from "@/hooks/useColorScheme";
import { mainStore } from "@/src/stores/main/main-store";
import { useEffect } from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import { useValue } from "tinybase/ui-react";

type Mode = "light" | "dark" | "system";

interface UseModeToggleReturn {
	isDark: boolean;
	mode: Mode;
	setMode: (mode: Mode) => void;
	currentMode: ColorSchemeName;
	toggleMode: () => void;
}

export function useModeToggle(): UseModeToggleReturn {
	const storedTheme = useValue("theme") as Mode | undefined;
	const mode: Mode = storedTheme || "system";
	const colorScheme = useColorScheme();
	const isDark = colorScheme === "dark";

	// Initialize theme from store on mount
	useEffect(() => {
		if (storedTheme) {
			if (storedTheme === "system") {
				Appearance.setColorScheme(null);
			} else {
				Appearance.setColorScheme(storedTheme);
			}
		}
	}, [storedTheme]);

	const toggleMode = () => {
		switch (mode) {
			case "light":
				setMode("dark");
				break;
			case "dark":
				setMode("system");
				break;
			case "system":
				setMode("light");
				break;
		}
	};

	const setMode = (newMode: Mode) => {
		// Persist theme to store
		mainStore.setValue("theme", newMode);

		if (newMode === "system") {
			Appearance.setColorScheme(null); // Reset to system default
		} else {
			Appearance.setColorScheme(newMode);
		}
	};

	return {
		isDark,
		mode,
		setMode,
		currentMode: colorScheme,
		toggleMode,
	};
}
