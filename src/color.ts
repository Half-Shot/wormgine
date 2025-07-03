import { ColorSource } from "pixi.js";

interface BackgroundPalette {
  gradient: [ColorSource, ColorSource];
  rainColor: ColorSource;
}

export const BackgroundPalettes: BackgroundPalette[] = [
  {
    gradient: ["rgba(3, 0, 51, 0.9)", "rgba(39, 0, 5, 0.9)"],
    rainColor: "rgba(25, 55, 25, 0.75)",
  },
];
