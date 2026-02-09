export interface IconVariant {
  id: string;
  background:
    | { type: "solid"; color: string }
    | {
        type: "gradient";
        stops: { offset: string; color: string }[];
        direction: "to-top" | "to-bottom";
      };
  birdFill: string;
}

export const ICON_VARIANTS: IconVariant[] = [
  {
    id: "Green",
    background: {
      type: "gradient",
      stops: [
        { offset: "0%", color: "#123308" },
        { offset: "100%", color: "#0b120c" },
      ],
      direction: "to-top",
    },
    birdFill: "#ffffff",
  },
  {
    id: "OrangeAndPink",
    background: {
      type: "gradient",
      stops: [
        { offset: "0%", color: "#dd8d45" },
        { offset: "100%", color: "#ebabfa" },
      ],
      direction: "to-top",
    },
    birdFill: "#ffffff",
  },
  {
    id: "DarkBlue",
    background: {
      type: "solid",
      color: "#1e3050",
    },
    birdFill: "#ffffff",
  },
  {
    id: "DarkBlueAndPurple",
    background: {
      type: "gradient",
      stops: [
        { offset: "0%", color: "#0b1243" },
        { offset: "100%", color: "#cb79c2" },
      ],
      direction: "to-top",
    },
    birdFill: "#ffffff",
  },
  {
    id: "LightBlueAndPink",
    background: {
      type: "gradient",
      stops: [
        { offset: "0%", color: "#5a91de" },
        { offset: "100%", color: "#ef85dd" },
      ],
      direction: "to-top",
    },
    birdFill: "#ffffff",
  },
  {
    id: "BlackAndWhite",
    background: {
      type: "gradient",
      stops: [
        { offset: "0%", color: "#ebebeb" },
        { offset: "100%", color: "#ffffff" },
      ],
      direction: "to-top",
    },
    birdFill: "#121212",
  },
];
