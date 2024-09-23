import { UPDATE_PRIORITY, Sprite, Point } from "pixi.js";
import { IMatterEntity } from "../entity";
import { Water } from "../water";
import { BodyWireframe } from "../../mixins/bodyWireframe.";
import globalFlags from "../../flags";
import { IMediaInstance, Sound } from "@pixi/sound";
import { GameWorld, PIXELS_PER_METER, RapierPhysicsObject } from "../../world";
import { ShapeContact, Vector2 } from "@dimforge/rapier2d-compat";

/**
 * Any object that is physically present in the world i.e. a worm.
 */
export abstract class PhysicsEntity implements IMatterEntity {
    protected isSinking = false;
    protected isDestroyed = false;
    protected sinkingY = 0;
    protected wireframe: BodyWireframe;
    
    protected renderOffset?: Point;

    public static splashSound: Sound;

    priority: UPDATE_PRIORITY = UPDATE_PRIORITY.NORMAL;
    private splashSoundPlayback?: IMediaInstance;

    public get destroyed() {
        return this.isDestroyed;
    }

    constructor(public readonly sprite: Sprite, protected body: RapierPhysicsObject, protected gameWorld: GameWorld) {
        this.wireframe = new BodyWireframe(this.body, globalFlags.DebugView);
        globalFlags.on('toggleDebugView', (on) => {
            this.wireframe.enabled = on;
        });
    }

    destroy(): void {
        this.isDestroyed = true;
        this.sprite.destroy();
        this.wireframe.renderable.destroy();
        this.gameWorld.removeBody(this.body);
        this.gameWorld.removeEntity(this);
    }

    update(dt: number): void {
        const pos = this.body.body.translation();
        const rotation = this.body.body.rotation();
        this.sprite.updateTransform({
            x: (pos.x * PIXELS_PER_METER) + (this.renderOffset?.x ?? 0),
            y: (pos.y * PIXELS_PER_METER) + (this.renderOffset?.y ?? 0),
            rotation
        });
        
        this.wireframe.update();

        // Sinking.
        if (this.isSinking) {
            this.body.body.setTranslation({x: pos.x, y: pos.y + (0.05 * dt)}, false);
            if (pos.y > this.sinkingY) {
                this.destroy();
            }
        }

    }

    onCollision(otherEnt: IMatterEntity, contactPoint: Vector2) {
        if (otherEnt instanceof Water) {
            console.log('hit water', this);

            if (!this.splashSoundPlayback?.progress || this.splashSoundPlayback.progress === 1) {
                // TODO: Hacks
                Promise.resolve(PhysicsEntity.splashSound.play()).then((instance) =>{
                    this.splashSoundPlayback = instance;
                })
            }
            const contactY = contactPoint.y;
            // Time to sink
            this.isSinking = true;
            this.sinkingY = contactY + 10;
            // Set static.
            this.body.body.setEnabled(false);
            return true;
        }
        return false;
    }
}