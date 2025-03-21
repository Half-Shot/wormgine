import { IPhysicalEntity } from "../entities/entity";
import { Container, PointData, Texture } from "pixi.js";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { AssetPack } from "../assets";
import { add, Coordinate, mult } from "../utils";
import { Vector2 } from "@dimforge/rapier2d-compat";

export enum IWeaponCode {
  Grenade = "wep_grenade",
  GasGrenade = "wep_grenade_gas",
  Bazooka = "wep_bazooka",
  Shotgun = "wep_shotgun",
  FireworkLauncher = "wep_firework",
  HomingMissile = "wep_missile",
  Mine = "wep_mine",
  MetalPotion = "wep_tool_metalpotion",
}

export interface FireOpts {
  duration?: number;
  timer?: number;
  angle?: number;
  target?: Coordinate;
}

export enum WeaponFireResult {
  // In order of importance for toasts
  NoHit, // Never appears if the others appear.
  KilledOwnTeam,
  KilledSelf,
  KilledEnemy,
  HitEnemy,
  HitOwnTeam,
  HitSelf,
}

/**
 * Calculate starting position and angle for a given projectile from a projectile weapon
 * @param wormPosition Worm position.
 * @param duration Duration fire button was held down for.
 * @param angle Aiming angle
 * @returns A position coodinate and a force vector.
 */
export function projectileWeaponHelper(
  wormPosition: Vector2,
  duration: number,
  angle: number,
) {
  const forceComponent = Math.log(duration / 10) * 3;
  const x = forceComponent * Math.cos(angle);
  const y = forceComponent * Math.sin(angle);
  const force = mult(new Vector2(1.15 * forceComponent, forceComponent), {
    x,
    y,
  });
  // TODO: Refactor ALL OF THIS
  const position = Coordinate.fromWorld(
    add(wormPosition, {
      x: Math.cos(angle) * 2,
      y: Math.sin(angle) * 2,
    }),
  );
  return { position, force };
}

export interface IWeaponDefiniton {
  name: string;
  code: IWeaponCode;
  icon: string;
  iconWidth?: number;
  /**
   * How long can the fire button be held down for?
   */
  maxDuration?: number;
  /**
   * Can the timer on the weapon be adjusted?
   */
  timerAdjustable?: boolean;
  /**
   * Should a guidance target be shown?
   */
  showTargetGuide?: boolean;
  /**
   * Does the worm need to pick a target first?
   */
  showTargetPicker?: boolean;
  /**
   * Should the worm be given getaway time?
   */
  allowGetaway?: boolean;

  sprite?: {
    texture: Texture;
    scale: PointData;
    offset: PointData;
  };
  /**
   * How many shots can the player take. Defaults to 1.
   */
  shots?: number;
  fireFn: (
    parent: Container,
    world: GameWorld,
    worm: Worm,
    opts: FireOpts,
  ) => IPhysicalEntity | void;
  loadAssets?: (assetPack: AssetPack) => void;
}
