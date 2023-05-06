import { Composite, Body, Vector } from "matter-js";
import { UPDATE_PRIORITY, Sprite } from "pixi.js";
import { IMatterEntity } from "../entity";
import { Water } from "../water";
import { BodyWireframe } from "../../mixins/bodyWireframe.";

/**
 * Any object that is physically present in the world i.e. a worm.
 */
export abstract class PhysicsEntity implements IMatterEntity {
    protected isSinking = false;
    protected sinkingY = 0;
    protected wireframe: BodyWireframe;

    priority: UPDATE_PRIORITY = UPDATE_PRIORITY.NORMAL;

    public get destroyed() {
        return this.sprite.destroyed;
    }
    
    entityOwnsBody(bodyId: number): boolean {
        return this.body.id === bodyId || this.body.parent.id === bodyId;
    }

    constructor(public readonly sprite: Sprite, protected body: Body, protected parent: Composite) {
        this.wireframe = new BodyWireframe(this.body);
    }

    destroy(): void {
        console.log('destroyed');
        if (this.parent) {
            Composite.remove(this.parent, this.body);
        }
        this.sprite.destroy();
        this.wireframe.renderable.destroy();
    }

    update(dt: number): void {
        this.sprite.position = this.body.position;
        this.sprite.rotation = this.body.angle;

        this.wireframe.update();

        // Sinking.
        if (this.isSinking) {
            this.body.position.y += 1 * dt;
            if (this.body.position.y > this.sinkingY) {
                this.destroy();
            }
        }

    }

    onCollision(otherEnt: IMatterEntity, contactPoint: Vector) {
        if (otherEnt instanceof Water) {
            console.log('hit water');
            // Time to sink
            this.isSinking = true;
            this.sinkingY = contactPoint.y + 200;
            Body.setStatic(this.body, true);
            return true;
        }
        return false;
    }
}