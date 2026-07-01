import { createLogger } from "@/src/logger";
import { mainStore } from "../stores/main/main-store";
import type { AppIconVariant } from "../data/app-icon-presets";

const logger = createLogger("AppIcon");

export type { AppIconVariant } from "../data/app-icon-presets";

// biome-ignore lint/suspicious/noExplicitAny: dynamically loaded native module
let AlternateAppIcons: any = null;
try {
  AlternateAppIcons = require("expo-alternate-app-icons");
} catch (error) {
  logger.warn("expo-alternate-app-icons native module not available", { error });
}

export async function setAppIconVariant(
  variantId: AppIconVariant
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!AlternateAppIcons) {
      throw new Error(
        "Alternate app icons are not supported in Expo Go. Please use a development build to change the app icon."
      );
    }
    if (variantId === "Default") {
      await AlternateAppIcons.resetAppIcon();
    } else {
      await AlternateAppIcons.setAlternateAppIcon(variantId);
    }
    mainStore.setValue("app_icon_variant", variantId);
    return { success: true };
  } catch (error) {
    logger.error("failed to set app icon", { variantId, error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function resetAppIcon(): Promise<{
  success: boolean;
  error?: string;
}> {
  return setAppIconVariant("Default");
}

export function getSelectedIconVariant(): AppIconVariant {
  const stored = mainStore.getValue("app_icon_variant") as AppIconVariant | undefined;
  return stored ?? "Default";
}

export async function getCurrentIconName(): Promise<string | null> {
  if (!AlternateAppIcons) return null;
  return AlternateAppIcons.getAppIconName();
}
