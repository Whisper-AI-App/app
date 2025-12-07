import { useState, useEffect } from "react";
import { Alert, StyleSheet, TouchableOpacity } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useValue } from "tinybase/ui-react";
import { ChevronLeft } from "lucide-react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { Separator } from "@/components/ui/separator";
import { Dial } from "@/components/ui/dial";
import { BackgroundPresetGrid } from "@/components/background-preset-grid";
import { Colors } from "@/theme/colors";
import { BORDER_RADIUS } from "@/theme/globals";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  pickBackgroundFromLibrary,
  setPresetBackground,
  resetToDefaultBackground,
  setBackgroundBlur,
  setBackgroundGrain,
  setBackgroundOpacity,
  resetBackgroundAdjustments,
  type BackgroundType,
} from "@/src/actions/chat-background";
import { getPresetById, type BackgroundPreset } from "@/src/data/background-presets";

export default function BackgroundSettings() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [isPickingImage, setIsPickingImage] = useState(false);

  const backgroundType = (useValue("chat_background_type") as BackgroundType) ?? "default";
  const backgroundUri = useValue("chat_background_uri") as string | undefined;
  const presetId = useValue("chat_background_preset_id") as string | undefined;
  const storedBlur = (useValue("chat_background_blur") as number) ?? 0;
  const storedGrain = (useValue("chat_background_grain") as number) ?? 0;
  const storedOpacity = (useValue("chat_background_opacity") as number) ?? 70;

  // Local state for smooth slider interaction (avoids store writes on every tick)
  const [localBlur, setLocalBlur] = useState(storedBlur);
  const [localGrain, setLocalGrain] = useState(storedGrain);
  const [localOpacity, setLocalOpacity] = useState(storedOpacity);

  // Sync local state when store values change externally (e.g., reset)
  useEffect(() => { setLocalBlur(storedBlur); }, [storedBlur]);
  useEffect(() => { setLocalGrain(storedGrain); }, [storedGrain]);
  useEffect(() => { setLocalOpacity(storedOpacity); }, [storedOpacity]);

  // Check if customization controls should be shown (only for custom or preset backgrounds)
  const showCustomizationControls = backgroundType === "custom" || (backgroundType === "preset" && presetId !== "none");

  const handlePickFromLibrary = () => {
    setIsPickingImage(true);
    pickBackgroundFromLibrary()
      .then((result) => {
        if (!result.success && result.error) {
          Alert.alert("Unable to Set Background", result.error);
        }
      })
      .catch((error) => {
        console.error("Error picking background:", error);
        Alert.alert("Error", "An unexpected error occurred");
      })
      .finally(() => {
        setIsPickingImage(false);
      });
  };

  const handleSelectPreset = (preset: BackgroundPreset) => {
    setPresetBackground(preset.id);
  };

  const handleResetToDefault = () => {
    resetToDefaultBackground();
  };

  // Determine the current selection state for UI
  const getCurrentSelectionLabel = () => {
    if (backgroundType === "custom") {
      return "Custom Photo";
    }
    if (backgroundType === "preset" && presetId) {
      return presetId === "none" ? "None" : presetId.replace("-", " ");
    }
    return "None";
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background }]}
      edges={["top", "left", "right"]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: "rgba(125,125,125,0.15)" }]}>
        <Button onPress={() => router.back()} variant="ghost" size="icon">
          <ChevronLeft color={theme.textMuted} strokeWidth={2} size={24} />
        </Button>
        <Text style={styles.headerTitle} pointerEvents="none">
          Chat Background
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Current Background Preview */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { opacity: 0.7 }]}>
            PREVIEW
          </Text>
          <View
            style={[
              styles.previewContainer,
              { backgroundColor: theme.background, borderColor: theme.border },
            ]}
          >
            {/* Background image */}
            {backgroundType === "custom" && backgroundUri ? (
              <Image
                source={{ uri: backgroundUri }}
                style={[styles.previewImage, { opacity: localOpacity / 100 }]}
                contentFit="cover"
                blurRadius={localBlur}
              />
            ) : backgroundType === "preset" && presetId && presetId !== "none" ? (
              <Image
                source={getPresetById(presetId)?.image}
                style={[styles.previewImage, { opacity: localOpacity / 100 }]}
                contentFit="cover"
                blurRadius={localBlur}
              />
            ) : (
              <View
                style={[styles.previewPlaceholder, { backgroundColor: theme.background }]}
              >
                <Ionicons
                  name="image-outline"
                  size={48}
                  color={theme.textMuted}
                />
                <Text style={{ color: theme.textMuted, marginTop: 8 }}>
                  {getCurrentSelectionLabel()}
                </Text>
              </View>
            )}
            {/* Grain overlay - only when there's a background image */}
            {showCustomizationControls && localGrain > 0 && (
              <Image
                source={
                  colorScheme === "dark"
                    ? require("@/assets/images/grain-dark.png")
                    : require("@/assets/images/grain.png")
                }
                style={[StyleSheet.absoluteFillObject, { opacity: localGrain / 100 }]}
                contentFit="cover"
              />
            )}
            {/* Theme overlay for text readability - always rendered like ChatBackground */}
            <View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: theme.background, opacity: 0.3 },
              ]}
            />
          </View>
        </View>

        {/* Customization Controls - only show when a background is selected */}
        {showCustomizationControls && (
          <View style={styles.section}>
            {/* Dials Row */}
            <View style={styles.dialsContainer}>
              <Dial
                value={localOpacity}
                onValueChange={setLocalOpacity}
                onDialComplete={setBackgroundOpacity}
                minimumValue={10}
                maximumValue={100}
                step={1}
                size={110}
                label="Opacity"
                unit="%"
              />
              <Dial
                value={localBlur}
                onValueChange={setLocalBlur}
                onDialComplete={setBackgroundBlur}
                minimumValue={0}
                maximumValue={20}
                step={1}
                size={110}
                label="Blur"
              />
              <Dial
                value={localGrain}
                onValueChange={setLocalGrain}
                onDialComplete={setBackgroundGrain}
                minimumValue={0}
                maximumValue={100}
                step={1}
                size={110}
                label="Grain"
                unit="%"
              />
            </View>

            {/* Reset Adjustments Button */}
            <TouchableOpacity
              style={styles.resetAdjustmentsButton}
              onPress={() => {
                Haptics.selectionAsync();
                resetBackgroundAdjustments();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.resetAdjustmentsText, { color: theme.blue }]}>
                Reset Adjustments
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Separator style={styles.separator} />

        {/* Choose from Photos */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { opacity: 0.7 }]}>
            CUSTOM PHOTO
          </Text>
          <TouchableOpacity
            style={[
              styles.photoButton,
              { backgroundColor: theme.card },
              backgroundType === "custom" && { borderColor: theme.blue, borderWidth: 2 },
            ]}
            onPress={handlePickFromLibrary}
            disabled={isPickingImage}
            activeOpacity={0.7}
          >
            <View style={styles.photoButtonContent}>
              <Ionicons
                name="images-outline"
                size={24}
                color={theme.blue}
              />
              <Text style={[styles.photoButtonText, { color: theme.text }]}>
                {isPickingImage ? "Opening Photos..." : "Choose from Photos"}
              </Text>
            </View>
            <ChevronLeft
              color={theme.textMuted}
              strokeWidth={2}
              size={20}
              style={{ transform: [{ rotate: "180deg" }] }}
            />
          </TouchableOpacity>
          <Text style={[styles.helperText, { color: theme.textMuted }]}>
            Select an image from your photo library
          </Text>
        </View>

        <Separator style={styles.separator} />

        {/* Preset Backgrounds */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { opacity: 0.7, marginLeft: 16 }]}>
            PRESETS
          </Text>
          <BackgroundPresetGrid
            selectedPresetId={backgroundType === "preset" ? presetId : (backgroundType === "default" || !backgroundType ? "none" : undefined)}
            onSelectPreset={handleSelectPreset}
          />
        </View>

        <Separator style={styles.separator} />

        {/* Reset Button */}
        <View style={[styles.section, { paddingHorizontal: 16 }]}>
          <Button
            variant="secondary"
            size="default"
            onPress={handleResetToDefault}
            style={{ width: "100%" }}
          >
            Reset to Default
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    position: "relative",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  section: {
    paddingTop: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  separator: {
    marginTop: 24,
  },
  previewContainer: {
    marginHorizontal: 24,
    height: 200,
    borderRadius: BORDER_RADIUS,
    overflow: "hidden",
    borderWidth: 1,
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  photoButton: {
    marginHorizontal: 24,
    padding: 16,
    borderRadius: BORDER_RADIUS / 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  photoButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photoButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  helperText: {
    fontSize: 13,
    marginTop: 8,
    paddingHorizontal: 24,
  },
  dialsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  resetAdjustmentsButton: {
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 4,
  },
  resetAdjustmentsText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
