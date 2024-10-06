import { Container } from "pixi.js";
import { FireOpts, IWeaponCode, IWeaponDefiniton } from "./weapon";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { add, Coordinate, mult } from "../utils";
import { BazookaShell } from "../entities/phys/bazookaShell";

export const WeaponBazooka: IWeaponDefiniton = {
    code: IWeaponCode.Bazooka,
    maxDuration: 80,
    timerAdjustable: false,
    showTargetGuide: true,
    fireFn(parent: Container, world: GameWorld, worm: Worm, opts: FireOpts) {
        if (opts.duration === undefined) {
            throw Error('Duration expected but not given');
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
        return BazookaShell.create(parent, world, position, force, worm.wormIdent);
    },
}