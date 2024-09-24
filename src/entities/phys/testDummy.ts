import { Container, Point, Sprite, Texture, UPDATE_PRIORITY, Text, DEG_TO_RAD, Graphics, BatchableGraphics } from "pixi.js";
import { PhysicsEntity } from "./physicsEntity";
import { getAssets } from "../../assets";
import { collisionGroupBitmask, CollisionGroups, GameWorld, PIXELS_PER_METER } from "../../world";
import { add, Coordinate, magnitude, MetersValue, mult, sub } from "../../utils";
import { ActiveEvents, ColliderDesc, RigidBodyDesc, Vector2 } from "@dimforge/rapier2d-compat";
import { IMatterEntity } from "../entity";
import { Explosion } from "../explosion";
import { teamGroupToColorSet, WormInstance } from "../../logic/gamestate";
import { applyGenericBoxStyle } from "../../mixins/styles";

export class TestDummy extends PhysicsEntity {
    public static DamageMultiplier = 250;
    public static readAssets(assets: ReturnType<typeof getAssets>) {
        TestDummy.texture_normal = assets.textures.testdummy;
        TestDummy.texture_blush = assets.textures.testdummy_blush;
        TestDummy.texture_damage_1 = assets.textures.testdummy_damage_1;
        TestDummy.texture_damage_blush_1 = assets.textures.testdummy_damage_blush_1;
        TestDummy.texture_damage_2 = assets.textures.testdummy_damage_2;
        TestDummy.texture_damage_blush_2 = assets.textures.testdummy_damage_blush_2;
        TestDummy.texture_damage_3 = assets.textures.testdummy_damage_3;
        TestDummy.texture_damage_blush_3 = assets.textures.testdummy_damage_blush_3;
    }

    public static texture_normal: Texture;
    public static texture_blush: Texture;
    public static texture_damage_1: Texture;
    public static texture_damage_blush_1: Texture;
    public static texture_damage_2: Texture;
    public static texture_damage_blush_2: Texture;
    public static texture_damage_3: Texture;
    public static texture_damage_blush_3: Texture;

    public declare priority: UPDATE_PRIORITY.LOW;
    private static readonly collisionBitmask = collisionGroupBitmask([CollisionGroups.WorldObjects], [CollisionGroups.Terrain, CollisionGroups.WorldObjects]);

    public wasMoving: boolean = true;
    public nameText: Text;
    public healthText: Text;
    public healthTextBox: Graphics;

    static create(parent: Container, world: GameWorld, position: Coordinate, wormIdent: WormInstance) {
        const ent = new TestDummy(position, world, wormIdent);
        world.addBody(ent, ent.body.collider);
        parent.addChild(ent.sprite);
        parent.addChild(ent.wireframe.renderable);
        parent.addChild(ent.healthTextBox);
        return ent;
    }

    get position() {
        return this.body.body.translation();
    }

    get health() {
        return this.wormIdent.health;
    }

    set health(v: number) {
        this.wormIdent.health = v;
        this.healthText.text = this.health;
    }

    private constructor(position: Coordinate, world: GameWorld, private readonly wormIdent: WormInstance) {
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
        super(sprite, body, world);
        this.renderOffset = new Point(4, 1);
        const {fg} = teamGroupToColorSet(wormIdent.team.group);
        this.nameText = new Text({
            text: this.wormIdent.name,
            style: {
                fontFamily: 'Arial',
                fontSize: 20,
                lineHeight: 32,
                fill: fg,
                align: 'center',
            },
        });
        this.healthText = new Text({
            text: this.health,
            style: {
                fontFamily: 'Arial',
                fontSize: 20,
                lineHeight: 32,
                fill: fg,
                align: 'center',
            },
        });
        this.healthTextBox = new Graphics();
        this.healthText.position.set((this.nameText.width/2) - this.healthText.width/2, 34);
        applyGenericBoxStyle(this.healthTextBox).roundRect(-5,0,this.nameText.width+10,30, 4).stroke().fill();
        applyGenericBoxStyle(this.healthTextBox).roundRect(((this.nameText.width/2) - this.healthText.width/2) - 5,36,this.healthText.width+10,28, 4).stroke().fill();
        this.healthTextBox.addChild(this.healthText, this.nameText);
    }

    private getTexture() {
        const isBlush = this.health < 100 && this.body.body.isMoving();

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
        super.update(dt);
        if (this.destroyed) {
            // TODO: Feels totally unnessacery.
            return;
        }
        if (!this.healthTextBox.destroyed) {
            this.healthTextBox.rotation = 0;
            this.healthTextBox.position.set(this.sprite.x - 50, this.sprite.y - 100);
        }
        const expectedTexture = this.getTexture();
        if (this.sprite.texture !== expectedTexture) {
            this.sprite.texture = expectedTexture;
        }
        if (!this.body.body.isMoving() && this.wasMoving) {
            this.wasMoving = false;
            this.body.body.setRotation(0, false);
            this.body.body.setTranslation(add(this.body.body.translation(), new Vector2(0, -0.25)), false);

            if (this.health === 0) {
                this.explode();
            }
        }
    }

    public explode() {
        const point = this.body.body.translation();
        const radius = new MetersValue(5);
        // Detect if anything is around us.
        for (const element of this.gameWorld.checkCollision(new Coordinate(point.x, point.y), radius, this.body.collider)) {
            if (element.onDamage) {
                element.onDamage(point, radius);
            }
        }
        this.gameWorld.addEntity(Explosion.create(this.gameWorld.viewport, new Point(point.x*PIXELS_PER_METER, point.y*PIXELS_PER_METER), radius, {
            shrapnelMax: 35,
            shrapnelMin: 15,
        }));
        this.destroy();
    }

    public onCollision(otherEnt: IMatterEntity, contactPoint: Vector2): boolean {
        if (super.onCollision(otherEnt, contactPoint)) {
            if (this.isSinking) {
                this.wormIdent.health = 0;
                this.healthTextBox.destroy();
                this.body.body.setRotation(DEG_TO_RAD*180, false);
            }
            return true;
        }
        return false;
    }

    public onDamage(point: Vector2, radius: MetersValue): void {
        console.log('Dummy damage!');
        const bodyTranslation = this.body.body.translation();
        const forceMag = radius.value/magnitude(sub(point,this.body.body.translation()));
        const damage = Math.round((forceMag/20)*TestDummy.DamageMultiplier);
        console.log(forceMag, (forceMag/20)*TestDummy.DamageMultiplier);
        this.health = Math.max(0, this.health - damage);
        const force = mult(sub(point, bodyTranslation), new Vector2(-forceMag, -forceMag));
        this.body.body.applyImpulse(force, true)
        this.wasMoving = true;
    }

    public destroy(): void {
        super.destroy();
        if (!this.healthTextBox.destroyed) {
            this.healthTextBox.destroy();
        }
        this.gameWorld.viewport.plugins.remove('follow');
        this.gameWorld.viewport.snap(800,0);
    }
}