import { Container, Sprite, Text, Texture, Ticker } from 'pixi.js';
import { TimedExplosive } from "./timedExplosive";
import { IMatterEntity } from '../entity';
import { BitmapTerrain } from '../bitmapTerrain';
import { IMediaInstance, Sound } from '@pixi/sound';
import { collisionGroupBitmask, CollisionGroups, GameWorld, PIXELS_PER_METER } from '../../world';
import { ActiveEvents, ColliderDesc, RigidBodyDesc, Vector2 } from '@dimforge/rapier2d-compat';
import { magnitude } from '../../utils';
import { MetersValue } from '../../utils/coodinate';
/**
 * Standard grenade projectile.
 */
export class Grenade extends TimedExplosive {
    private static readonly FRICTION = 0.15;
    private static readonly collisionBitmask = collisionGroupBitmask(CollisionGroups.WorldObjects, [CollisionGroups.Terrain, CollisionGroups.WorldObjects]);
    public static texture: Texture;
    public static bounceSoundsLight: Sound;
    public static boundSoundHeavy: Sound;

    static async create(parent: Container, world: GameWorld, position: {x: number, y: number}, initialForce: { x: number, y: number}) {
        const ent = new Grenade(position, initialForce, world);
        parent.addChild(ent.sprite, ent.wireframe.renderable);
        return ent;
    }

    private timerText: Text;

    private get timerTextValue() {
        return `${(this.timer / (Ticker.targetFPMS*1000)).toFixed(1)}`
    }
    public bounceSoundPlayback?: IMediaInstance;

    private constructor(position: { x: number, y: number }, initialForce: { x: number, y: number}, world: GameWorld) {
        const sprite = new Sprite(Grenade.texture);
        sprite.scale.set(0.5);
        sprite.anchor.set(0.5);
        const body = world.createRigidBodyCollider(
            ColliderDesc.roundCuboid(
                0.05,
                0.05, 0.50).setActiveEvents(ActiveEvents.COLLISION_EVENTS)
                .setCollisionGroups(Grenade.collisionBitmask)
                .setSolverGroups(Grenade.collisionBitmask),
            RigidBodyDesc
                .dynamic()
                .setTranslation(position.x/PIXELS_PER_METER, position.y/PIXELS_PER_METER)
                // .setLinvel(initialForce.x, initialForce.y)
                // .setLinearDamping(Grenade.FRICTION)
            );
        sprite.position = body.body.translation();
        console.log("Created grenade body", body.collider.handle);
        super(sprite, body, world, {
            explosionRadius: new MetersValue(3),
            explodeOnContact: false,
            timerSecs: 2.5,
        });
        //Body.applyForce(body, Vector.create(body.position.x - 20, body.position.y), initialForce);
        this.timerText = new Text({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 24,
                fill: 0xFFFFFF,
                align: 'center',
            }
        });
        this.sprite.addChild(this.timerText);
    }

    update(dt: number): void {
        super.update(dt);
        if (this.sprite.destroyed) {
            return;
        }
        
        this.wireframe.setDebugText(`velocity: ${Math.round(magnitude(this.body.body.linvel())*1000)/1000}`)

        // Body.applyForce(this.body, Vector.create(this.body.position.x - 5, this.body.position.y - 5), Vector.create(this.initialForce.x, this.initialForce.y));
        if (!this.timerText.destroyed) {
            this.timerText.rotation = -this.body.body.rotation();
            this.timerText.text = this.timerTextValue;
        }
        
    }

    onCollision(otherEnt: IMatterEntity, contactPoint: Vector2) {
        if (super.onCollision(otherEnt, contactPoint)) {
            this.timerText.destroy();
            return true;
        }
        // We don't explode, but we do make a noise.
        if (otherEnt instanceof BitmapTerrain === false) {
            return false;
        }

        const velocity = magnitude(this.body.body.linvel());

        // TODO: can these interrupt?
        if (!this.bounceSoundPlayback?.progress || this.bounceSoundPlayback.progress === 1 && this.timer > 0) {
            // TODO: Hacks
            Promise.resolve(
                (velocity >= 8 ? Grenade.boundSoundHeavy : Grenade.bounceSoundsLight).play()
            ).then((instance) =>{
                this.bounceSoundPlayback = instance;
            })
        }
        return false;
    }

    destroy(): void {
        super.destroy();
    }
}