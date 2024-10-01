import { IGameEntity } from "../entities/entity";
import { Container } from "pixi.js";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";

export enum IWeaponCode {
    Grenade,
}

export interface FireOpts {
    duration?: number,
    timer?: number,
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
    fireFn: (parent: Container, world: GameWorld, worm: Worm, opts: FireOpts) => IGameEntity,
}
