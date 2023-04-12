import { IGameEntity } from "../entities/entity";
import { Container, DisplayObject } from "pixi.js";
import { Composite } from "matter-js";
import { Worm } from "../entities/phys/worm";

export enum IWeaponCode {
    Grenade,
}

export interface IWeaponDefiniton {
    code: IWeaponCode,
    maxDuration: number,
    fireFn: (parent: Container<DisplayObject>, composite: Composite, worm: Worm, duration: number) => PromiseLike<IGameEntity>,
}