import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { TimedExplosive } from "./timedExplosive";
import { GameWorld } from '../../world';
import { ColliderDesc, RigidBodyDesc, Vector2, VectorOps } from "@dimforge/rapier2d-compat";
import { MetersValue } from '../../utils/coodinate';
import { AssetPack } from '../../assets';

/**
 * Standard shell, affected by wind.
 */
export class BazookaShell extends TimedExplosive {
    public static readAssets(assets: AssetPack) {
        BazookaShell.texture = assets.textures.bazooka;
    }

    private static texture: Texture;

    private readonly force: Vector2 = VectorOps.zeros();
    private readonly gfx = new Graphics();
    
    static async create(parent: Container, gameWorld: GameWorld, position: {x: number, y: number}, initialAngle: number, initialForce: number, wind: number) {
        const ent = new BazookaShell(position, initialAngle, gameWorld, initialForce, wind);
        gameWorld.addBody(ent, ent.body.collider);
        parent.addChild(ent.sprite);
        parent.addChild(ent.wireframe.renderable);
        return ent;
    }

    private constructor(position: { x: number, y: number }, initialAngle: number, world: GameWorld, initialForce: number, private readonly wind: number) {
        const sprite = new Sprite(BazookaShell.texture);
        const body = world.createRigidBodyCollider(
            ColliderDesc.cuboid(sprite.width/2, sprite.height/2),
            RigidBodyDesc
                .dynamic()
                .setTranslation(position.x, position.y)
                .setLinvel(initialForce / 10, initialForce / 100)
                // TODO: Check
                // TODO: Friction
                .setAngvel(initialAngle)
                .setLinearDamping(0.05)
            );

        super(sprite, body, world, {
            explosionRadius: new MetersValue(3.5),
            explodeOnContact: true,
            timerSecs: 30,
            autostartTimer: true,
        });
        this.sprite.x = position.x;
        this.sprite.y = position.y;
        this.sprite.scale.set(0.5, 0.5);
        this.sprite.anchor.set(0.5, 0.5);
    }
    

    update(dt: number): void {
        super.update(dt);
        if (!this.body || this.sprite.destroyed) {
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