import { Container } from "pixi.js";
import { Grenade } from "../entities/phys/grenade";
import { FireOpts, IWeaponCode, IWeaponDefiniton } from "./weapon";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { add, Coordinate, mult } from "../utils";

export const WeaponGrenade: IWeaponDefiniton = {
    code: IWeaponCode.Grenade,
    maxDuration: 50,
    timerAdjustable: true,
    showTargetGuide: true,
    fireFn(parent: Container, world: GameWorld, worm: Worm, opts: FireOpts) {
        if (!opts.duration) {
            throw Error('Duration expected but not given');
        }
        if (!opts.timer) {
            throw Error('Timer expected but not given');
        }
        if (opts.angle === undefined) {
            throw Error('Angle expected but not given');
        }
        const forceComponent = opts.duration/8;
        const x = forceComponent*Math.cos(opts.angle);
        const y = forceComponent*Math.sin(opts.angle);
        const force = mult(new Vector2(1 * forceComponent, forceComponent), { x, y });
        // TODO: Refactor ALL OF THIS
        const position = Coordinate.fromWorld(add(worm.position, {x, y: -0.3})); 
        return Grenade.create(parent, world, position, force, opts.timer, worm.wormIdent);
    },
}