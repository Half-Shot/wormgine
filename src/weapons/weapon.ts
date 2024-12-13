import { IWeaponEntity } from "../entities/entity";
import { Container } from "pixi.js";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { AssetPack } from "../assets";
import { Coordinate } from "../utils";

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
