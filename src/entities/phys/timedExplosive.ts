import { Body, Vector, Bodies } from "matter-js";
import { UPDATE_PRIORITY, Ticker, Sprite } from "pixi.js";
import { BitmapTerrain } from "../bitmapTerrain";
import { IMatterEntity } from "../entity";
import { PhysicsEntity } from "./physicsEntity";
import { Explosion } from "../explosion";
import { GameWorld } from "../../world";

interface Opts {
    explosionRadius: number,
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

    constructor(sprite: Sprite, body: Body, gameWorld: GameWorld, public readonly opts: Opts) {
        super(sprite, body, gameWorld);
        this.gameWorld.addBody(this, body);
        this.timer = Ticker.targetFPMS * opts.timerSecs * 1000;
    }

    onTimerFinished() {
        if (!this.body || !this.gameWorld) {
            throw Error('Timer expired without a body');
        }
        this.onExplode();
    }

    onExplode() {
        const point = this.body.position;
        const radius = this.opts.explosionRadius;
        // Detect if anything is around us.
        const hitOtherEntity = this.gameWorld.checkCollision(Bodies.circle(point.x, point.y, radius), this);
        console.log("onExplode", hitOtherEntity);
        this.gameWorld.addEntity(Explosion.create(this.gameWorld.viewport, point, radius, 15, 35));
        // Find contact point with any terrain
        if (hitOtherEntity) {
            this.onCollision(hitOtherEntity, point);
        }
        
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

    onCollision(otherEnt: IMatterEntity, contactPoint: Vector) {
        if (super.onCollision(otherEnt, contactPoint)) {
            if (this.isSinking) {
                this.timer = 0;
                this.body.angle = 0.15;
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