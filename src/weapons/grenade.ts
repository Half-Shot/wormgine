import { Container } from "pixi.js";
import { Grenade } from "../entities/phys/grenade";
import { IWeaponCode, IWeaponDefiniton } from "./weapon";
import { Composite, Vector } from "matter-js";
import { Worm } from "../entities/phys/worm";
import { Game } from "../game";

export const WeaponGrenade: IWeaponDefiniton = {
    code: IWeaponCode.Grenade,
    maxDuration: 50,
    fireFn(game: Game, parent: Container, composite: Composite, worm: Worm, duration: number) {
        const forceComponent = duration/800;
        console.log('Force component', forceComponent)
        const force = Vector.create(1 * forceComponent, 0.001);
        const position = Vector.add(worm.position, Vector.create(0, -50))
        return Grenade.create(game, parent, composite, position, force);
    },
}