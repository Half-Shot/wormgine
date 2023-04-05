import Matter, { Composite, Body, Vector } from "matter-js";
import { UPDATE_PRIORITY, Texture, Ticker, Sprite } from "pixi.js";
import { BitmapTerrain } from "../bitmapTerrain";
import { IMatterEntity } from "../entity";
import { PhysicsEntity } from "./physicsEntity";

interface Opts {
    explosionRadius: number,
    explodeOnContact: boolean,
    timerSecs: number,
}

export abstract class TimedExplosive extends PhysicsEntity implements IMatterEntity  {
    protected timer: number;
    protected isSinking = false;
    public explodeHandler ?: ((point: Matter.Vector, radius: number) => void) | undefined;

    priority: UPDATE_PRIORITY = UPDATE_PRIORITY.NORMAL;

    constructor(sprite: Sprite, body: Body, parent: Composite, public readonly opts: Opts) {
        super(sprite, body, parent)
        this.timer = Ticker.targetFPMS * opts.timerSecs * 1000;
    }

    onTimerFinished() {
        if (!this.body || !this.parent) {
            throw Error('Timer expired without a body');
        }
        this.explodeHandler?.(this.body.position, this.opts.explosionRadius);
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
                this.body!.angle = 0.15;
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