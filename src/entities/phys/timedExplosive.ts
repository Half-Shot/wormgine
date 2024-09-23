import { UPDATE_PRIORITY, Ticker, Sprite, Point } from "pixi.js";
import { BitmapTerrain } from "../bitmapTerrain";
import { IMatterEntity } from "../entity";
import { PhysicsEntity } from "./physicsEntity";
import { Explosion } from "../explosion";
import { GameWorld, PIXELS_PER_METER, RapierPhysicsObject } from "../../world";
import { Vector2 } from "@dimforge/rapier2d";
import { MetersValue } from "../../utils/coodinate";

interface Opts {
    explosionRadius: MetersValue,
    explodeOnContact: boolean,
    timerSecs: number,
}

/**
 * Any projectile type that can explode after a set timer. Currently does not handle
 * the rendering of a timer.
 */
export abstract class TimedExplosive extends PhysicsEntity implements IMatterEntity  {
    protected timer: number;
    protected isSinking = false;

    priority: UPDATE_PRIORITY = UPDATE_PRIORITY.NORMAL;

    constructor(sprite: Sprite, body: RapierPhysicsObject, gameWorld: GameWorld, public readonly opts: Opts) {
        super(sprite, body, gameWorld);
        this.gameWorld.addBody(this, body.collider);
        this.timer = Ticker.targetFPMS * opts.timerSecs * 1000;
    }

    onTimerFinished() {
        if (!this.body || !this.gameWorld) {
            throw Error('Timer expired without a body');
        }
        this.onExplode();
    }

    onExplode() {
        const point = this.body.body.translation();
        const radius = this.opts.explosionRadius;
        // Detect if anything is around us.
        for (const element of this.gameWorld.checkCollision(point, radius.value, this.body.collider)) {
            this.onCollision(element, point);
        }
        this.gameWorld.addEntity(Explosion.create(this.gameWorld.viewport, new Point(point.x*PIXELS_PER_METER, point.y*PIXELS_PER_METER), radius, 15, 35));
        
    }

    update(dt: number): void {
        super.update(dt);
        if (this.timer > 0) {
            this.timer -= dt;
        } else if (this.timer <= 0 && !this.isSinking) {
            this.onTimerFinished();
            this.destroy();
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
        if (!this.opts.explodeOnContact && this.timer <= 0 && otherEnt instanceof BitmapTerrain) {
            console.log('Collided with terrain at', contactPoint);
            // Create a circle around the area, see what hits
            otherEnt.onDamage(contactPoint, this.opts.explosionRadius);
            this.timer = 0;
            return true;
        }
        return false;
    }
}