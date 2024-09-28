import { Sprite, Texture, UPDATE_PRIORITY } from "pixi.js";
import { AssetPack } from "../../assets";
import { collisionGroupBitmask, CollisionGroups, GameWorld, PIXELS_PER_METER } from "../../world";
import { Coordinate, MetersValue } from "../../utils";
import { ActiveEvents, ColliderDesc, RigidBodyDesc } from "@dimforge/rapier2d-compat";
import { WormInstance } from "../../logic/teams";
import { PlayableEntity } from "./playable";
import { Viewport } from "pixi-viewport";

/**
 * Test dummy entity that may be associated with a worm identity. These
 * dummies cannot move or take turns, but count towards the total
 * hitpoints for a team.
 */
export class TestDummy extends PlayableEntity {

    public static readAssets(assets: AssetPack) {
        TestDummy.texture_normal = assets.textures.testDolby;
        TestDummy.texture_blush = assets.textures.testDolbyBlush;
        TestDummy.texture_damage_1 = assets.textures.testDolbyDamage1;
        TestDummy.texture_damage_blush_1 = assets.textures.testDolbyDamage1Blush;
        TestDummy.texture_damage_2 = assets.textures.testDolbyDamage2Blush;
        TestDummy.texture_damage_blush_2 = assets.textures.testDolbyDamage2Blush;
        TestDummy.texture_damage_3 = assets.textures.testDolbyDamage3;
        TestDummy.texture_damage_blush_3 = assets.textures.testDolbyDamage3Blush;
    }

    private static texture_normal: Texture;
    private static texture_blush: Texture;
    private static texture_damage_1: Texture;
    private static texture_damage_blush_1: Texture;
    private static texture_damage_2: Texture;
    private static texture_damage_blush_2: Texture;
    private static texture_damage_3: Texture;
    private static texture_damage_blush_3: Texture;

    priority = UPDATE_PRIORITY.LOW;
    private static readonly collisionBitmask = collisionGroupBitmask([CollisionGroups.WorldObjects], [CollisionGroups.Terrain, CollisionGroups.WorldObjects]);


    static create(parent: Viewport, world: GameWorld, position: Coordinate, wormIdent: WormInstance) {
        const ent = new TestDummy(position, world, parent, wormIdent);
        world.addBody(ent, ent.physObject.collider);
        parent.addChild(ent.sprite);
        parent.addChild(ent.wireframe.renderable);
        parent.addChild(ent.healthTextBox);
        return ent;
    }

    private constructor(position: Coordinate, world: GameWorld, parent: Viewport, wormIdent: WormInstance) {
        const sprite = new Sprite(TestDummy.texture_normal);
        sprite.scale.set(0.20);
        sprite.anchor.set(0.5);
        const body = world.createRigidBodyCollider(
            ColliderDesc.cuboid((sprite.width-7) / (PIXELS_PER_METER*2), (sprite.height-15) / (PIXELS_PER_METER*2))
            .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
            .setCollisionGroups(TestDummy.collisionBitmask)
            .setSolverGroups(TestDummy.collisionBitmask)
            .setMass(0.35),
            RigidBodyDesc.dynamic().setTranslation(position.worldX, position.worldY)
        );
        super(sprite, body, world, parent, wormIdent, {
            explosionRadius: new MetersValue(3),
            damageMultiplier: 250,
        });
    }

    private getTexture() {
        const isBlush = this.health < 100 && this.physObject.body.isMoving();

        if (this.health >= 80) {
            return isBlush ? TestDummy.texture_blush : TestDummy.texture_normal;
        } else if (this.health >= 60) {
            return isBlush ? TestDummy.texture_damage_blush_1 : TestDummy.texture_damage_1;
        } else if (this.health >= 25) {
            return isBlush ? TestDummy.texture_damage_blush_2 : TestDummy.texture_damage_2;
        } else {
            return isBlush ? TestDummy.texture_damage_blush_3 : TestDummy.texture_damage_3;
        }
    }

    public update(dt: number): void {
        const expectedTexture = this.getTexture();
        if (this.sprite.texture !== expectedTexture) {
            this.sprite.texture = expectedTexture;
        }
        super.update(dt);
    }

    public destroy(): void {
        super.destroy();
        this.parent.plugins.remove('follow');
        this.parent.snap(800,0);
    }
}