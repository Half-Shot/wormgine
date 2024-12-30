import { ColorSource, Graphics, TextOptions } from "pixi.js";

export function applyGenericBoxStyle(
  gfx: Graphics,
  borderColor: ColorSource = 0xaaaaaa,
) {
  return gfx
    .setStrokeStyle({
      width: 2,
      color: borderColor,
      cap: "butt",
      join: "round",
    })
    .setFillStyle({ color: 0x111111, alpha: 0.95 });
}

export const DefaultTextStyle = {
  fontFamily: "Monogram",
  fontSize: 28,
  fill: 0xffffff,
  align: "left",
} as TextOptions["style"];

export const LargeTextStyle = {
  fontFamily: "Monogram",
  fontSize: 64,
  fill: 0xffffff,
  align: "left",
} as TextOptions["style"];
