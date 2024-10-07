import { Color, Container, Graphics, Point, Sprite, Texture, UPDATE_PRIORITY } from 'pixi.js';
import { TimedExplosive } from "./timedExplosive";
import { IPhysicalEntity } from '../entity';
import { IMediaInstance, Sound } from '@pixi/sound';
import { collisionGroupBitmask, CollisionGroups, GameWorld } from '../../world';
import { ActiveEvents, ColliderDesc, RigidBodyDesc, Vector2 } from '@dimforge/rapier2d-compat';
import { Coordinate, MetersValue } from '../../utils/coodinate';
import { AssetPack } from '../../assets';
import { BitmapTerrain } from '../bitmapTerrain';


const COLOUR_SET = [
    0x08ff08,
    0xffcf00,
    0xfe1493,
    0xff5555,
    0x00fdff,
    0xccff02
];

/**
 * Firework projectile.
 */
export class Firework extends TimedExplosive {
    public static readAssets(assets: AssetPack) {
        Firework.texture = assets.textures.firework;
        Firework.screamSound = assets.sounds.firework;
    }

    private static readonly collisionBitmask = collisionGroupBitmask(CollisionGroups.WorldObjects, [CollisionGroups.Terrain, CollisionGroups.WorldObjects]);
    private static texture: Texture;
    private static screamSound: Sound;
    private scream?: Promise<IMediaInstance>;
    private readonly gfx: Graphics;
    private trail: {
        point: Point,
        speed: Point,
        accel: Point,
        radius: number,
        alpha: number,
        kind: "fire"|"pop"
    }[] = [];

    priority = UPDATE_PRIORITY.LOW;

    static create(parent: Container, world: GameWorld, position: Coordinate) {
        const ent = new Firework(position, world, parent);
        parent.addChild(ent.sprite, ent.wireframe.renderable, ent.gfx);
        return ent;
    }

    private constructor(position: Coordinate, world: GameWorld, parent: Container) {
        const sprite = new Sprite(Firework.texture);
        sprite.scale.set(0.15);
        sprite.anchor.set(0.5);

        const upwardVeolcity = 60 + Math.ceil(Math.random()*30);
        const xVelocity = -30 + Math.ceil(Math.random()*120);

        const rot = Math.atan2(upwardVeolcity, Math.abs(xVelocity)) - 1;

        const primaryColor = COLOUR_SET[Math.floor(Math.random()*COLOUR_SET.length)];
        const secondaryColor = COLOUR_SET[Math.floor(Math.random()*COLOUR_SET.length)]

        const body = world.createRigidBodyCollider(
            ColliderDesc.roundCuboid(
                0.05,
                0.05, 0.50).setActiveEvents(ActiveEvents.COLLISION_EVENTS)
                .setCollisionGroups(Firework.collisionBitmask)
                .setSolverGroups(Firework.collisionBitmask).setMass(0.5),
            RigidBodyDesc
                .dynamic()
                .setTranslation(position.worldX, position.worldY)
                // Fix rot
                .setLinvel(xVelocity, -upwardVeolcity).setLinearDamping(1.5).lockRotations().setRotation(rot)
            );
    
        sprite.position = body.body.translation();
        super(sprite, body, world, parent, {
            explosionRadius: new MetersValue(4),
            explodeOnContact: true,
            explosionHue: primaryColor,
            explosionShrapnelHue: secondaryColor,
            timerSecs: 1.33,
            autostartTimer: true,
            maxDamage: 35,
        });
        this.scream = Promise.resolve(Firework.screamSound.play());
        this.gfx = new Graphics();
    }

    update(dt: number): void {
        if (!this.sprite.destroyed) {
            super.update(dt);
        } 

        this.gfx.clear();
        if (!this.hasExploded) {
            const xSpeed = (Math.random()*0.5)-0.25;
            const kind = Math.random() >= 0.75 ? "fire" : "pop";
            const coodinate = new Coordinate(this.physObject.body.translation().x, this.physObject.body.translation().y);
            this.trail.push({
                alpha: 1,
                point: new Point(coodinate.screenX, coodinate.screenY),
                speed: new Point(
                    xSpeed,
                    0.5,
                ),
                accel: new Point(
                    // Invert the accel
                    xSpeed/2,
                    0.25
                ),
                radius: 1 + Math.random()*(kind === "pop" ? 4.5 : 2.5),
                kind,
            })
        }

        const shrapnelHue = new Color(0xaaaaaa);
        for (const shrapnel of this.trail) {
            shrapnel.speed.x += shrapnel.accel.x*dt;
            shrapnel.speed.y += shrapnel.accel.y*dt;
            shrapnel.point.x += shrapnel.speed.x*dt;
            shrapnel.point.y += shrapnel.speed.y*dt;
            shrapnel.alpha = Math.max(0, shrapnel.alpha-(Math.random()*dt*0.03));
            if (shrapnel.alpha === 0) {
                this.trail.splice(this.trail.indexOf(shrapnel), 1);
            }
            if (shrapnel.kind === "pop") {
                this.gfx.circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius).fill({ color: shrapnelHue, alpha: shrapnel.alpha });
            } else {
                this.gfx.circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius).fill({ color: 0xfd4301, alpha: shrapnel.alpha });
                this.gfx.circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius-3).fill({ color: 0xfde101, alpha: shrapnel.alpha });
            }
        }

        if (this.trail.length === 0 && this.hasExploded) {
            this.destroy();
        }
    }

    onCollision(otherEnt: IPhysicalEntity, contactPoint: Vector2) {
        if (super.onCollision(otherEnt, contactPoint)) {
            if (this.isSinking) {
                this.scream?.then((b) => {
                    b.stop();
                });
            }
            return true;
        }
        if (otherEnt instanceof BitmapTerrain || otherEnt === this) {
            // Meh.
            return false;
        }
        return false;
    }

    destroy(): void {
        if (this.trail.length) {
            super.destroy();
            this.isDestroyed = false;
            // Skip until the trail has gone
            return;
        }
        this.scream?.then((b) => {
            b.stop();
        })
        this.gfx.clear();
        this.gfx.destroy();
        this.isDestroyed = true;
    }
}