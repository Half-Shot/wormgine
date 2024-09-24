import { UPDATE_PRIORITY, Ticker, Sprite, Point, ColorSource } from "pixi.js";
import { IMatterEntity } from "../entity";
import { PhysicsEntity } from "./physicsEntity";
import { Explosion } from "../explosion";
import { GameWorld, PIXELS_PER_METER, RapierPhysicsObject } from "../../world";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from "../../utils/coodinate";

interface Opts {
    explosionRadius: MetersValue,
    explodeOnContact: boolean,
    explosionHue?: ColorSource,
    explosionShrapnelHue?: ColorSource,
    autostartTimer: boolean,
    timerSecs?: number,
}

/**
 * Any projectile type that can explode after a set timer. Currently does not handle
 * the rendering of a timer.
 */
export abstract class TimedExplosive extends PhysicsEntity implements IMatterEntity  {
    protected timer: number|undefined;
    protected isSinking = false;
    private hasExploded = false;

    priority: UPDATE_PRIORITY = UPDATE_PRIORITY.NORMAL;

    constructor(sprite: Sprite, body: RapierPhysicsObject, gameWorld: GameWorld, public readonly opts: Opts) {
        super(sprite, body, gameWorld);
        this.gameWorld.addBody(this, body.collider);
        if (opts.autostartTimer) {
            this.timer = opts.timerSecs ? Ticker.targetFPMS * opts.timerSecs * 1000 : 0;
        }
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
        if (!this.body || !this.gameWorld) {
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
        const point = this.body.body.translation();
        const radius = this.opts.explosionRadius;
        // Detect if anything is around us.
        const explosionCollidesWith = this.gameWorld.checkCollision(new Coordinate(point.x, point.y), radius, this.body.collider);
        for (const element of explosionCollidesWith) {
            element.onDamage?.(point, this.opts.explosionRadius);
        }
        this.gameWorld.addEntity(Explosion.create(this.gameWorld.viewport, new Point(point.x*PIXELS_PER_METER, point.y*PIXELS_PER_METER), radius, {
            shrapnelMax: 35,
            shrapnelMin: 15,
            hue: this.opts.explosionHue ?? 0xffffff,
            shrapnelHue: this.opts.explosionShrapnelHue ?? 0xffffff,
        }));
    }

    update(dt: number): void {
        super.update(dt);
        if (this.timer !== undefined) {
            if (this.timer > 0) {
                this.timer -= dt;
            } else if (this.timer <= 0 && !this.isSinking) {
                this.onTimerFinished();
                this.destroy();
            }
        }
    }

    onCollision(otherEnt: IMatterEntity, contactPoint: Vector2) {
        if (super.onCollision(otherEnt, contactPoint)) {
            if (this.isSinking) {
                this.timer = 0;
                this.body.body.setRotation(0.15, false);
            }
            return true;
        }

        if (this.opts.explodeOnContact && this.hasExploded) {
            this.onExplode();
            return true;
        }
        
        return false;
    }
}