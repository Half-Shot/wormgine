import { Collider, Vector2 } from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from "./coodinate";
import { GameWorld, PIXELS_PER_METER } from "../world";
import { WeaponFireResult } from "../weapons/weapon";
import type { Worm } from "../entities/playable/worm";
import { WormInstance } from "../logic/teams";
import { Explosion, ExplosionsOptions } from "../entities/explosion";
import { Container } from "pixi.js";
import { OnDamageOpts } from "../entities/entity";

interface Opts extends Partial<ExplosionsOptions>, OnDamageOpts {

}

export function handleDamageInRadius(
    gameWorld: GameWorld, parent: Container, point: Vector2,
    radius: MetersValue, opts: Opts, ignoreCollider?: Collider, ownerWorm?: WormInstance) {
    // Detect if anything is around us.
    const explosionCollidesWith = gameWorld.checkCollision(new Coordinate(point.x, point.y), radius, ignoreCollider);
    const fireResults = new Set<WeaponFireResult>();
    console.log(explosionCollidesWith);
    for (const element of explosionCollidesWith) {
        element.onDamage?.(point, radius, opts);
        // Dependency issue, Worm depends on us.
        if ('health' in element) {
            const worm = element as unknown as Worm;
            const killed = element.health === 0;
            if (worm.wormIdent.uuid === ownerWorm?.uuid) {
                fireResults.add(killed ? WeaponFireResult.KilledSelf : WeaponFireResult.HitSelf);
            } else if (worm.wormIdent.team.group === ownerWorm?.team.group) {
                fireResults.add(killed ? WeaponFireResult.KilledOwnTeam : WeaponFireResult.HitSelf);
            } else if (worm.wormIdent.team.group !== ownerWorm?.team.group) {
                fireResults.add(killed ? WeaponFireResult.KilledEnemy : WeaponFireResult.HitEnemy);
            }
        }
    }
    gameWorld.addEntity(Explosion.create(parent, {x: point.x*PIXELS_PER_METER, y: point.y*PIXELS_PER_METER}, radius, opts));
    return fireResults.size === 0 ? [WeaponFireResult.NoHit] : [...fireResults];
}