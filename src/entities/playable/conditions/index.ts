import { ColorSource } from "pixi.js";

export enum PlayableCondition {
  Sickness = "sickness",
  Metallic = "metallic",
}

export interface PlayableConditonAttributes {
  takeDamagePerRound?: number;
  hue?: ColorSource;
  cannotDieFromDamage?: boolean;
  damageMultiplier?: number;
  forceMultiplier?: number;
}

export function getConditionEffect(
  condition: PlayableCondition,
): PlayableConditonAttributes {
  switch (condition) {
    case PlayableCondition.Sickness:
      return {
        takeDamagePerRound: 5,
        cannotDieFromDamage: true,
        hue: "rgba(34, 204, 0, 0.47)",
      };
    case PlayableCondition.Metallic:
      return {
        hue: "rgba(100, 100, 100, 0.6)",
        damageMultiplier: 0.75,
        forceMultiplier: 0.25,
      };
  }
}

export function getConditionTint(
  conditions: Iterable<PlayableCondition>,
): ColorSource | null {
  let tint = null;
  // Priority ordering
  for (const condition of conditions) {
    switch (condition) {
      case PlayableCondition.Sickness:
        return "rgba(34, 204, 0, 0.47)";
      case PlayableCondition.Metallic:
        tint = "rgba(100, 100, 100, 0.6)";
    }
  }
  return tint;
}
