import { Composite, Body, Vector, Bodies, Query } from "matter-js";
import { UPDATE_PRIORITY, Ticker, Sprite } from "pixi.js";
import { BitmapTerrain } from "../bitmapTerrain";
import { IMatterEntity } from "../entity";
import { PhysicsEntity } from "./physicsEntity";
import { Game } from "../../game";
import { Explosion } from "../explosion";

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

    constructor(private readonly game: Game, sprite: Sprite, body: Body, parent: Composite, public readonly opts: Opts) {
        super(sprite, body, parent)
        this.timer = Ticker.targetFPMS * opts.timerSecs * 1000;
    }

    onTimerFinished() {
        if (!this.body || !this.parent) {
            throw Error('Timer expired without a body');
        }
        this.onExplode();
    }

    onExplode() {
        const point = this.body.position;
        const radius = this.opts.explosionRadius;
        // Detect if anything is around us.
        const circ = Bodies.circle(point.x, point.y, radius);
        const hit = Query.collides(circ, this.game.matterEngine.world.bodies).sort((a,b) => b.depth - a.depth);
        this.game.addEntity(Explosion.create(this.game.viewport, point, radius));
        console.log("Timed explosive hit", hit);
        // Find contact point with any terrain
        for (const hitBody of hit) {
            const ents = (this.game.findEntityByBodies(hitBody.bodyA, hitBody.bodyB)).filter(e => e !== this);
            if (ents[0]) {
                // TODO: Cheating massively
                this.onCollision(ents[0], hitBody.bodyA.position);
            }
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