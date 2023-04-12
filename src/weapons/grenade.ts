import { Container, DisplayObject } from "pixi.js";
import { Grenade } from "../entities/phys/grenade";
import { IWeaponCode, IWeaponDefiniton } from "./weapon";
import { Composite, Vector } from "matter-js";
import { Worm } from "../entities/phys/worm";

export const WeaponGrenade: IWeaponDefiniton = {
    code: IWeaponCode.Grenade,
    maxDuration: 50,
    fireFn(parent: Container<DisplayObject>, composite: Composite, worm: Worm, duration: number) {
        const forceComponent = duration/200;
        const force = Vector.create(1 * forceComponent, 0.001);
        const position = Vector.add(worm.position, Vector.create(0, -50))
        return Grenade.create(parent, composite, position, force);
    },
}