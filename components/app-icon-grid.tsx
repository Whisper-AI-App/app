import { useColorScheme } from "@/hooks/useColorScheme";
import {
  APP_ICON_PRESETS,
  type AppIconPreset,
  type AppIconVariant,
} from "@/src/data/app-icon-presets";
import { Colors } from "@/theme/colors";
import { BORDER_RADIUS } from "@/theme/globals";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Plus } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "@/components/ui/text";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

interface AppIconGridProps {
  selectedIconId: AppIconVariant;
  onSelectIcon: (preset: AppIconPreset) => void;
}

export function AppIconGrid({
  selectedIconId,
  onSelectIcon,
}: AppIconGridProps) {
  const colorScheme = useColorScheme() ?? "light";
  const theme = Colors[colorScheme];
  const router = useRouter();

  return (
    <View style={styles.grid}>
      {APP_ICON_PRESETS.map((preset) => {
        const isSelected = selectedIconId === preset.id;

        return (
          <TouchableOpacity
            key={preset.id}
            style={[
              styles.iconItem,
              { backgroundColor: theme.card },
              isSelected && { borderColor: theme.blue, borderWidth: 3 },
            ]}
            onPress={() => onSelectIcon(preset)}
            activeOpacity={0.7}
          >
            <Image
              source={preset.image}
              style={styles.iconPreview}
              contentFit="cover"
            />
            <Text style={styles.iconName} numberOfLines={1}>
              {preset.name}
            </Text>
            {isSelected && (
              <View style={[styles.checkmark, { backgroundColor: theme.blue }]}>
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Customize Icon Grid Item */}
      <TouchableOpacity
        style={[styles.iconItem, { backgroundColor: theme.card }]}
        onPress={() => {
          Haptics.selectionAsync();
          router.push("/settings/customize-icon");
        }}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.customizePreview,
            {
              borderColor: theme.indigo,
              backgroundColor: colorScheme === "dark" ? "rgba(94, 92, 230, 0.08)" : "rgba(88, 86, 214, 0.06)",
            },
          ]}
        >
          <LinearGradient
            colors={[theme.indigo, theme.purple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.plusCircle}
          >
            <Plus color="#FFFFFF" strokeWidth={3.5} size={18} />
          </LinearGradient>
        </View>
        <Text style={styles.iconName} numberOfLines={1}>
          Customize
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 16,
  },
  iconItem: {
    width: "30%",
    aspectRatio: 0.85,
    borderRadius: BORDER_RADIUS / 2,
    overflow: "hidden",
    alignItems: "center",
    paddingVertical: 12,
  },
  iconPreview: {
    width: 64,
    height: 64,
    borderRadius: 14,
  },
  customizePreview: {
    width: 64,
    height: 64,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  plusCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  iconName: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  checkmark: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});
