import { Composite, Body, Vector } from "matter-js";
import { UPDATE_PRIORITY, Sprite } from "pixi.js";
import { IMatterEntity, IMatterPluginInfo } from "../entity";
import { Water } from "../water";
import { BodyWireframe } from "../../mixins/bodyWireframe.";
import globalFlags from "../../flags";
import { IMediaInstance, Sound } from "@pixi/sound";
import { GameWorld } from "../../world";

/**
 * Any object that is physically present in the world i.e. a worm.
 */
export abstract class PhysicsEntity implements IMatterEntity {
    protected isSinking = false;
    protected sinkingY = 0;
    protected wireframe: BodyWireframe;

    public static splashSound: Sound;

    priority: UPDATE_PRIORITY = UPDATE_PRIORITY.NORMAL;
    private splashSoundPlayback?: IMediaInstance;

    public get destroyed() {
        return this.sprite.destroyed;
    }
    
    entityOwnsBody(bodyId: number): boolean {
        return this.body.id === bodyId || this.body.parent.id === bodyId;
    }

    constructor(public readonly sprite: Sprite, protected body: Body, protected gameWorld: GameWorld) {
        this.wireframe = new BodyWireframe(this.body, globalFlags.DebugView);
        globalFlags.on('toggleDebugView', (on) => {
            this.wireframe.enabled = on;
        });
        (body.plugin as IMatterPluginInfo).wormgineEntity = this;
    }

    destroy(): void {
        console.log('destroyed');
        this.sprite.destroy();
        this.wireframe.renderable.destroy();
        this.gameWorld.removeBody(this.body);
        this.gameWorld.removeEntity(this);
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
        console.log('onCollision');
        if (otherEnt instanceof Water) {
            console.log('hit water');

            if (!this.splashSoundPlayback?.progress || this.splashSoundPlayback.progress === 1) {
                // TODO: Hacks
                Promise.resolve(PhysicsEntity.splashSound.play()).then((instance) =>{
                    this.splashSoundPlayback = instance;
                })
            }
            // Time to sink
            this.isSinking = true;
            this.sinkingY = contactPoint.y + 200;
            Body.setStatic(this.body, true);
            return true;
        }
        return false;
    }
}