import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TimedExplosive } from "./timedExplosive";
import { collisionGroupBitmask, CollisionGroups, GameWorld } from '../../world';
import { ActiveEvents, ColliderDesc, RigidBodyDesc, Vector2, VectorOps } from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from '../../utils/coodinate';
import { AssetPack } from '../../assets';
import { WormInstance } from '../../logic/teams';

/**
 * Standard shell, affected by wind.
 */
export class BazookaShell extends TimedExplosive {
    public static readAssets(assets: AssetPack) {
        BazookaShell.texture = assets.textures.bazooka;
    }

    private static readonly collisionBitmask = collisionGroupBitmask(CollisionGroups.WorldObjects, [CollisionGroups.Terrain, CollisionGroups.WorldObjects]);
    private static texture: Texture;

    private readonly force: Vector2 = VectorOps.zeros();
    private readonly gfx = new Graphics();
    
    static create(parent: Container, gameWorld: GameWorld, position: Coordinate, force: Vector2, owner?: WormInstance) {
        const ent = new BazookaShell(position, gameWorld, parent, force, owner);
        gameWorld.addBody(ent, ent.physObject.collider);
        parent.addChild(ent.sprite);
        parent.addChild(ent.wireframe.renderable);
        return ent;
    }

    private constructor(position: Coordinate, world: GameWorld, parent: Container, initialForce: Vector2, owner?: WormInstance) {
        const sprite = new Sprite(BazookaShell.texture);
        const body = world.createRigidBodyCollider(
            ColliderDesc.cuboid(
                0.50,
                0.20).setActiveEvents(ActiveEvents.COLLISION_EVENTS)
                .setCollisionGroups(BazookaShell.collisionBitmask)
                .setSolverGroups(BazookaShell.collisionBitmask).setMass(1),
                // TODO: Angle rotation the right way.
            RigidBodyDesc
                .dynamic()
                .setTranslation(position.worldX, position.worldY)
                .setLinvel(initialForce.x, initialForce.y)
                // TODO: Check
                // TODO: Friction
                .setLinearDamping(0.05)
            );

        super(sprite, body, world, parent, {
            explosionRadius: new MetersValue(2.25),
            explodeOnContact: true,
            timerSecs: 30,
            autostartTimer: true,
            ownerWorm: owner,
            maxDamage: 45,
        });
        this.sprite.x = position.screenX;
        this.sprite.y = position.screenY;
        this.sprite.scale.set(0.5, 0.5);
        this.sprite.anchor.set(0.5, 0.5);
        this.rotationOffset = Math.PI/2;
    }
    

    update(dt: number): void {
        super.update(dt);
        if (!this.physObject || this.sprite.destroyed) {
            return;
        }
        // Fix for other angles.
        this.force.x *= Math.min(1, dt * 3);
        this.force.y *= Math.min(1, dt * 3);
    }

    destroy(): void {
        super.destroy();
        this.gfx.destroy();
    }
}