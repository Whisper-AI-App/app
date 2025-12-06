import type { ImageSource } from "expo-image";

export interface BackgroundPreset {
  id: string;
  name: string;
  image: ImageSource;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: "none",
    name: "None",
    image: null as unknown as ImageSource,
  },
  {
    id: "bg-1",
    name: "Background 1",
    image: require("@/assets/images/backgrounds/1.jpg"),
  },
  {
    id: "bg-2",
    name: "Background 2",
    image: require("@/assets/images/backgrounds/2.jpg"),
  },
  {
    id: "bg-3",
    name: "Background 3",
    image: require("@/assets/images/backgrounds/3.jpg"),
  },
  {
    id: "bg-4",
    name: "Background 4",
    image: require("@/assets/images/backgrounds/4.jpg"),
  },
  {
    id: "bg-5",
    name: "Background 5",
    image: require("@/assets/images/backgrounds/5.jpg"),
  },
  {
    id: "bg-6",
    name: "Background 6",
    image: require("@/assets/images/backgrounds/6.jpg"),
  },
  {
    id: "bg-7",
    name: "Background 7",
    image: require("@/assets/images/backgrounds/7.jpg"),
  },
  {
    id: "bg-8",
    name: "Background 8",
    image: require("@/assets/images/backgrounds/8.jpg"),
  },
  {
    id: "bg-9",
    name: "Background 9",
    image: require("@/assets/images/backgrounds/9.jpg"),
  },
  {
    id: "bg-10",
    name: "Background 10",
    image: require("@/assets/images/backgrounds/10.jpg"),
  },
  {
    id: "bg-11",
    name: "Background 11",
    image: require("@/assets/images/backgrounds/11.jpg"),
  },
  {
    id: "bg-12",
    name: "Background 12",
    image: require("@/assets/images/backgrounds/12.jpg"),
  },
  {
    id: "bg-13",
    name: "Background 13",
    image: require("@/assets/images/backgrounds/13.jpg"),
  },
  {
    id: "bg-14",
    name: "Background 14",
    image: require("@/assets/images/backgrounds/14.jpg"),
  },
  {
    id: "bg-15",
    name: "Background 15",
    image: require("@/assets/images/backgrounds/15.jpg"),
  },
];

export function getPresetById(id: string): BackgroundPreset | undefined {
  return BACKGROUND_PRESETS.find((preset) => preset.id === id);
}
