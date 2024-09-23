import { Container, Sprite, Text, Texture, Ticker, UPDATE_PRIORITY } from 'pixi.js';
import { TimedExplosive } from "./timedExplosive";
import { IMatterEntity } from '../entity';
import { IMediaInstance, Sound } from '@pixi/sound';
import { collisionGroupBitmask, CollisionGroups, GameWorld, PIXELS_PER_METER } from '../../world';
import { ActiveEvents, Collider, ColliderDesc, RigidBodyDesc, Vector2 } from '@dimforge/rapier2d-compat';
import { Coordinate, MetersValue } from '../../utils/coodinate';
import { getAssets } from '../../assets';
import { BitmapTerrain } from '../bitmapTerrain';

/**
 * Proximity mine.
 */
export class Mine extends TimedExplosive {
    public static readAssets(assets: ReturnType<typeof getAssets>) {
        Mine.texture = assets.textures.mine;
        Mine.textureActive = assets.textures.mineActive;
        Mine.beep = assets.sounds.mineBeep;
    }

    private static MineTriggerRadius = new MetersValue(5);

    private static readonly collisionBitmask = collisionGroupBitmask(CollisionGroups.WorldObjects, [CollisionGroups.Terrain, CollisionGroups.WorldObjects]);
    private static readonly sensorCollisionBitmask = collisionGroupBitmask(CollisionGroups.WorldObjects, [CollisionGroups.Player]);
    private static texture: Texture;
    private static textureActive: Texture;
    private static beep: Sound;
    private readonly sensor: Collider;
    private beeping?: Promise<IMediaInstance>;
    public timerText: Text;

    static create(parent: Container, world: GameWorld, position: Coordinate) {
        const ent = new Mine(position, world);
        parent.addChild(ent.sprite, ent.wireframe.renderable);
        return ent;
    }

    private get timerTextValue() {
        return `${((this.timer ?? 0) / (Ticker.targetFPMS*1000)).toFixed(1)}`
    }
    public bounceSoundPlayback?: IMediaInstance;

    private constructor(position: Coordinate, world: GameWorld) {
        const sprite = new Sprite(Mine.texture);
        sprite.scale.set(0.15);
        sprite.anchor.set(0.5);
        const body = world.createRigidBodyCollider(
            ColliderDesc.roundCuboid(
                0.05,
                0.05, 0.50).setActiveEvents(ActiveEvents.COLLISION_EVENTS)
                .setCollisionGroups(Mine.collisionBitmask)
                .setSolverGroups(Mine.collisionBitmask),
            RigidBodyDesc
                .dynamic()
                .setTranslation(position.worldX, position.worldY)
            );
    
        sprite.position = body.body.translation();
        super(sprite, body, world, {
            explosionRadius: new MetersValue(4),
            explodeOnContact: false,
            timerSecs: 5,
            autostartTimer: false,
        });
        this.sensor = world.rapierWorld.createCollider(ColliderDesc.ball(
            Mine.MineTriggerRadius.value).setActiveEvents(ActiveEvents.COLLISION_EVENTS)
            .setCollisionGroups(Mine.sensorCollisionBitmask)
            .setSolverGroups(Mine.sensorCollisionBitmask)
            .setSensor(true));
        this.gameWorld.addBody(this, this.sensor);
        this.timerText = new Text({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 100,
                fill: 0xFFFFFF,
                align: 'center',
            }
        });
        sprite.addChild(this.timerText);
    }

    update(dt: number): void {
        super.update(dt);
        if (this.sprite.destroyed) {
            return;
        }


        if (this.timer) {
            this.sprite.texture = (this.timer % 20) > 10 ? Mine.texture : Mine.textureActive;
        }

        if (!this.timerText.destroyed && this.timer) {
            this.timerText.rotation = -this.body.body.rotation();
            this.timerText.text = this.timerTextValue;
        }
        this.sensor.setTranslation(this.body.body.translation());
    }

    onCollision(otherEnt: IMatterEntity, contactPoint: Vector2) {
        if (super.onCollision(otherEnt, contactPoint)) {
            if (this.isSinking) {
                this.timerText.destroy();
                this.beeping?.then((b) => {
                    b.stop();
                    this.beeping = Promise.resolve(Mine.beep.play({speed: 0.5, volume: 0.25}));
                });
            }
            return true;
        }
        if (otherEnt instanceof BitmapTerrain || otherEnt === this) {
            // Meh.
            return false;
        }
        console.log('Collision', otherEnt);
        if (this.timer === undefined) {
            this.startTimer();
            this.beeping = Promise.resolve(Mine.beep.play({loop: true}));
        }
        return false;
    }

    destroy(): void {
        this.beeping?.then((b) => {
            b.stop();
        })
        super.destroy();
        this.gameWorld.rapierWorld.removeCollider(this.sensor, false);
    }
}