import { Container } from "pixi.js";
import { Grenade } from "../entities/phys/grenade";
import { IWeaponCode, IWeaponDefiniton } from "./weapon";
import { Worm } from "../entities/phys/worm";
import { Game } from "../game";
import { GameWorld } from "../world";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { add, Coordinate } from "../utils";

export const WeaponGrenade: IWeaponDefiniton = {
    code: IWeaponCode.Grenade,
    maxDuration: 50,
    fireFn(parent: Container, world: GameWorld, worm: Worm, duration: number) {
        const forceComponent = duration/800;
        console.log('Force component', forceComponent)
        const force = new Vector2(1 * forceComponent, 0.001);
        const position = add(worm.position, new Vector2(0, -50))
        return Grenade.create(parent, world, Coordinate.fromScreen(position.x, position.y), force);
    },
}