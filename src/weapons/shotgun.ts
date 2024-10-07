import { Container } from "pixi.js";
import { FireOpts, IWeaponCode, IWeaponDefiniton, WeaponFireResult } from "./weapon";
import { Worm } from "../entities/playable/worm";
import { GameWorld } from "../world";
import { Coordinate, MetersValue } from "../utils";
import { handleDamageInRadius } from "../utils/damage";

// TODO: Needs delay, two shots.
const radius = new MetersValue(1.5);

export const WeaponShotgun: IWeaponDefiniton = {
    code: IWeaponCode.Shotgun,
    timerAdjustable: false,
    showTargetGuide: true,
    fireFn(parent: Container, world: GameWorld, worm: Worm, opts: FireOpts) {
        if (opts.angle === undefined) {
            throw Error('Angle expected but not given');
        }
        const x = Math.cos(opts.angle);
        const y = Math.sin(opts.angle);
        const hit = world.rayTrace(
            Coordinate.fromWorld(worm.position),
            {x,y},
            worm.collider,
        );
        if (hit) {
            const result = handleDamageInRadius(
                world, parent, hit.hitLoc.toWorldVector(), radius,
                {
                    shrapnelMax: 15,
                    shrapnelMin: 10,
                    maxDamage: 25,
                }, undefined, worm.wormIdent);
            return {
                onFireResult: Promise.resolve(result)
            }
        }
        return {
            onFireResult: Promise.resolve([WeaponFireResult.NoHit])
        }
    },
}