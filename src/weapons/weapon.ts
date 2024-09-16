import { IGameEntity } from "../entities/entity";
import { Container } from "pixi.js";
import { Composite } from "matter-js";
import { Worm } from "../entities/phys/worm";
import { Game } from "../game";
import { GameWorld } from "../world";

export enum IWeaponCode {
    Grenade,
}

export interface IWeaponDefiniton {
    code: IWeaponCode,
    maxDuration: number,
    fireFn: (game: Game, parent: Container, world: GameWorld, worm: Worm, duration: number) => PromiseLike<IGameEntity>,
}