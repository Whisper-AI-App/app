import { useState } from "react";
import { Alert, StyleSheet, TouchableOpacity } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { useValue } from "tinybase/ui-react";
import { ChevronLeft } from "lucide-react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
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
  const blur = (useValue("chat_background_blur") as number) ?? 0;
  const grain = (useValue("chat_background_grain") as number) ?? 0;
  const opacity = (useValue("chat_background_opacity") as number) ?? 70;

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
                style={[styles.previewImage, { opacity: opacity / 100 }]}
                contentFit="cover"
                blurRadius={blur}
              />
            ) : backgroundType === "preset" && presetId && presetId !== "none" ? (
              <Image
                source={getPresetById(presetId)?.image}
                style={[styles.previewImage, { opacity: opacity / 100 }]}
                contentFit="cover"
                blurRadius={blur}
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
            {showCustomizationControls && grain > 0 && (
              <Image
                source={
                  colorScheme === "dark"
                    ? require("@/assets/images/grain-dark.png")
                    : require("@/assets/images/grain.png")
                }
                style={[StyleSheet.absoluteFillObject, { opacity: grain / 100 }]}
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
            <Text style={[styles.sectionLabel, { opacity: 0.7 }]}>
              ADJUSTMENTS
            </Text>

            {/* Opacity Slider */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={[styles.sliderLabel, { color: theme.text }]}>
                  Opacity
                </Text>
                <Text style={[styles.sliderValue, { color: theme.textMuted }]}>
                  {Math.round(opacity)}%
                </Text>
              </View>
              <Slider
                value={opacity}
                onValueChange={setBackgroundOpacity}
                minimumValue={10}
                maximumValue={100}
                step={1}
              />
            </View>

            {/* Blur Slider */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={[styles.sliderLabel, { color: theme.text }]}>
                  Blur
                </Text>
                <Text style={[styles.sliderValue, { color: theme.textMuted }]}>
                  {Math.round(blur)}
                </Text>
              </View>
              <Slider
                value={blur}
                onValueChange={setBackgroundBlur}
                minimumValue={0}
                maximumValue={20}
                step={1}
              />
            </View>

            {/* Grain Slider */}
            <View style={styles.sliderContainer}>
              <View style={styles.sliderHeader}>
                <Text style={[styles.sliderLabel, { color: theme.text }]}>
                  Grain
                </Text>
                <Text style={[styles.sliderValue, { color: theme.textMuted }]}>
                  {Math.round(grain)}%
                </Text>
              </View>
              <Slider
                value={grain}
                onValueChange={setBackgroundGrain}
                minimumValue={0}
                maximumValue={100}
                step={1}
              />
            </View>

            {/* Reset Adjustments Button */}
            <TouchableOpacity
              style={styles.resetAdjustmentsButton}
              onPress={resetBackgroundAdjustments}
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
  sliderContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sliderLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: "400",
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
