import { useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useValue } from "tinybase/ui-react";
import { ChevronLeft } from "lucide-react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { View } from "@/components/ui/view";
import { Separator } from "@/components/ui/separator";
import { AppIconGrid } from "@/components/app-icon-grid";
import { Colors } from "@/theme/colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { setAppIconVariant, resetAppIcon } from "@/src/actions/app-icon";
import {
  getAppIconPresetById,
  APP_ICON_PRESETS,
  type AppIconPreset,
  type AppIconVariant,
} from "@/src/data/app-icon-presets";

export default function AppIconSettings() {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const router = useRouter();

  const [isChanging, setIsChanging] = useState(false);

  const storedVariant = (useValue("app_icon_variant") as AppIconVariant) ?? "Default";
  const currentPreset = getAppIconPresetById(storedVariant) ?? APP_ICON_PRESETS[0];

  const handleSelectIcon = async (preset: AppIconPreset) => {
    if (preset.id === storedVariant) return;

    Haptics.selectionAsync();
    setIsChanging(true);

    const result = await setAppIconVariant(preset.id);

    setIsChanging(false);

    if (!result.success) {
      Alert.alert("Unable to Change Icon", result.error ?? "An unexpected error occurred");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleResetToDefault = async () => {
    if (storedVariant === "Default") return;

    Haptics.selectionAsync();
    setIsChanging(true);

    const result = await resetAppIcon();

    setIsChanging(false);

    if (!result.success) {
      Alert.alert("Unable to Reset Icon", result.error ?? "An unexpected error occurred");
    }
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
          App Icon
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Current Icon Preview */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { opacity: 0.7 }]}>
            CURRENT ICON
          </Text>
          <View style={styles.previewWrapper}>
            <Image
              source={currentPreset.image}
              style={styles.previewContainer}
              contentFit="cover"
            />
            <Text style={[styles.previewLabel, { color: theme.text }]}>
              {currentPreset.name}
            </Text>
          </View>
        </View>

        <Separator style={styles.separator} />

        {/* Icon Selection Grid */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { opacity: 0.7, marginLeft: 16 }]}>
            CHOOSE ICON
          </Text>
          <AppIconGrid
            selectedIconId={storedVariant}
            onSelectIcon={handleSelectIcon}
          />
        </View>

        <Separator style={styles.separator} />

        {/* Reset Button */}
        <View style={[styles.section, { paddingHorizontal: 16 }]}>
          <Button
            variant="secondary"
            size="default"
            onPress={handleResetToDefault}
            disabled={isChanging || storedVariant === "Default"}
            style={{ width: "100%" }}
          >
            {isChanging ? "Changing..." : "Reset to Default"}
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
  previewWrapper: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  previewContainer: {
    width: 100,
    height: 100,
    borderRadius: 22,
  },
  previewLabel: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "500",
  },
});
