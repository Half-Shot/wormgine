import { IGameEntity } from "../entities/entity";
import { Container } from "pixi.js";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";

export enum IWeaponCode {
    Grenade,
}

export interface IWeaponDefiniton {
    code: IWeaponCode,
    maxDuration: number,
    fireFn: (parent: Container, world: GameWorld, worm: Worm, duration: number) => IGameEntity,
}