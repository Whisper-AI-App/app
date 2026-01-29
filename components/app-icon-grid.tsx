import { useColorScheme } from "@/hooks/useColorScheme";
import {
  APP_ICON_PRESETS,
  type AppIconPreset,
  type AppIconVariant,
} from "@/src/data/app-icon-presets";
import { Colors } from "@/theme/colors";
import { BORDER_RADIUS } from "@/theme/globals";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "@/components/ui/text";

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
