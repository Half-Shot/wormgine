import { IWeaponEntity } from "../entities/entity";
import { Container } from "pixi.js";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { AssetPack } from "../assets";

export enum IWeaponCode {
    Grenade,
    Bazooka,
    Shotgun,
}

export interface FireOpts {
    duration?: number,
    timer?: number,
    angle?: number,
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
    code: IWeaponCode,
    /**
     * How long can the fire button be held down for?
     */
    maxDuration?: number,
    /**
     * Can the timer on the weapon be adjusted?
     */
    timerAdjustable?: boolean,
    showTargetGuide?: boolean,
    fireFn: (parent: Container, world: GameWorld, worm: Worm, opts: FireOpts) => IWeaponEntity,
    loadAssets?: (assetPack: AssetPack) => void,
}
