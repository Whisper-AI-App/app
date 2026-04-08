import {
  setAlternateAppIcon,
  getAppIconName,
  resetAppIcon as resetAlternateAppIcon,
} from "expo-alternate-app-icons";
import { createLogger } from "@/src/logger";
import { mainStore } from "../stores/main/main-store";
import type { AppIconVariant } from "../data/app-icon-presets";

const logger = createLogger("AppIcon");

export type { AppIconVariant } from "../data/app-icon-presets";

export async function setAppIconVariant(
  variantId: AppIconVariant
): Promise<{ success: boolean; error?: string }> {
  try {
    if (variantId === "Default") {
      await resetAlternateAppIcon();
    } else {
      await setAlternateAppIcon(variantId);
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
  return getAppIconName();
}
