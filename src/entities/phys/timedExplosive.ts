import { UPDATE_PRIORITY, Ticker, Sprite, Point, ColorSource, Container } from "pixi.js";
import { IPhysicalEntity, IWeaponEntity } from "../entity";
import { PhysicsEntity } from "./physicsEntity";
import { Explosion } from "../explosion";
import { GameWorld, PIXELS_PER_METER, RapierPhysicsObject } from "../../world";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from "../../utils/coodinate";
import { WeaponFireResult } from "../../weapons/weapon";
import { WormInstance } from "../../logic/teams";
import type { Worm } from "../playable/worm";

interface Opts {
    explosionRadius: MetersValue,
    explodeOnContact: boolean,
    explosionHue?: ColorSource,
    explosionShrapnelHue?: ColorSource,
    autostartTimer: boolean,
    timerSecs?: number,
    ownerWorm?: WormInstance,
}

/**
 * Any projectile type that can explode after a set timer. Implementing classes
 * must include their own timer.
 */
export abstract class TimedExplosive extends PhysicsEntity implements IWeaponEntity  {
    protected timer: number|undefined;
    protected hasExploded = false;

    private fireResultFn!: (fireResult: WeaponFireResult[]) => void;
    public onFireResult: Promise<WeaponFireResult[]>;

    priority = UPDATE_PRIORITY.NORMAL;

    constructor(sprite: Sprite, body: RapierPhysicsObject, gameWorld: GameWorld, private readonly parent: Container, protected readonly opts: Opts) {
        super(sprite, body, gameWorld);
        this.gameWorld.addBody(this, body.collider);
        if (opts.autostartTimer) {
            this.timer = opts.timerSecs ? Ticker.targetFPMS * opts.timerSecs * 1000 : 0;
        }
        // TODO: timeout.
        this.onFireResult = new Promise((r) => this.fireResultFn = r);
    }

    startTimer() {
        if (this.timer !== undefined) {
            throw Error('Timer already started');
        }
        if (!this.opts.timerSecs) {
            throw Error('No timer secs defined');
        }
        this.timer = Ticker.targetFPMS * this.opts.timerSecs * 1000;
    }

    onTimerFinished() {
        if (!this.physObject || !this.gameWorld) {
            throw Error('Timer expired without a body');
        }
        this.onExplode();
    }

    onExplode() {
        if (this.hasExploded) {
            throw Error('Tried to explode twice');
        }
        this.hasExploded = true;
        this.timer = undefined;
        const point = this.physObject.body.translation();
        const radius = this.opts.explosionRadius;
        // Detect if anything is around us.
        const explosionCollidesWith = this.gameWorld.checkCollision(new Coordinate(point.x, point.y), radius, this.physObject.collider);
        let fireResults = new Set<WeaponFireResult>();
        for (const element of explosionCollidesWith) {
            element.onDamage?.(point, this.opts.explosionRadius);
            // Dependency issue, Worm depends on us.
            if ('health' in element) {
                const worm = element as Worm;
                const killed = element.health === 0;
                if (worm.wormIdent.uuid === this.opts.ownerWorm?.uuid) {
                    fireResults.add(killed ? WeaponFireResult.KilledSelf : WeaponFireResult.HitSelf);
                } else if (worm.wormIdent.team.group === this.opts.ownerWorm?.team.group) {
                    fireResults.add(killed ? WeaponFireResult.KilledOwnTeam : WeaponFireResult.HitSelf);
                } else if (worm.wormIdent.team.group !== this.opts.ownerWorm?.team.group) {
                    fireResults.add(killed ? WeaponFireResult.KilledEnemy : WeaponFireResult.HitEnemy);
                }
            }
        }
        this.fireResultFn(fireResults.size === 0 ? [WeaponFireResult.NoHit] : [...fireResults]);
        this.gameWorld.addEntity(Explosion.create(this.parent, new Point(point.x*PIXELS_PER_METER, point.y*PIXELS_PER_METER), radius, {
            shrapnelMax: 35,
            shrapnelMin: 15,
            hue: this.opts.explosionHue ?? 0xffffff,
            shrapnelHue: this.opts.explosionShrapnelHue ?? 0xffffff,
        }));
        this.destroy();
    }

    update(dt: number): void {
        super.update(dt);
        if (this.timer !== undefined) {
            if (this.timer > 0) {
                this.timer -= dt;
            } else if (this.timer <= 0 && !this.isSinking) {
                this.onTimerFinished();
            }
        }
    }

    onCollision(otherEnt: IPhysicalEntity, contactPoint: Vector2) {
        if (super.onCollision(otherEnt, contactPoint)) {
            if (this.isSinking) {
                this.timer = 0;
                this.physObject.body.setRotation(0.15, false);
            }
            return true;
        }

        if (this.opts.explodeOnContact && !this.hasExploded) {
            this.onExplode();
            return true;
        }
        
        return false;
    }
}