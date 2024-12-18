import { IWeaponEntity } from "../entities/entity";
import { Container } from "pixi.js";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { AssetPack } from "../assets";
import { add, Coordinate, mult } from "../utils";
import { Vector2 } from "@dimforge/rapier2d-compat";

export enum IWeaponCode {
  Grenade,
  Bazooka,
  Shotgun,
  FireworkLauncher,
  HomingMissile,
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
export function projectileWeaponHelper(wormPosition: Vector2, duration: number, angle: number) {
  const forceComponent = Math.log(duration / 10) * 3;
  const x = forceComponent * Math.cos(angle);
  const y = forceComponent * Math.sin(angle);
  const force = mult(new Vector2(1.5 * forceComponent, forceComponent), {
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
  showTargetGuide?: boolean;
  showTargetPicker?: boolean;

  /**
   * How many shots can the player take. Defaults to 1.
   */
  shots?: number;
  fireFn: (
    parent: Container,
    world: GameWorld,
    worm: Worm,
    opts: FireOpts,
  ) => IWeaponEntity;
  loadAssets?: (assetPack: AssetPack) => void;
}
