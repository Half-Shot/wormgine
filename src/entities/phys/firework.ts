import { Container, Sprite, Texture, UPDATE_PRIORITY } from "pixi.js";
import { TimedExplosive } from "./timedExplosive";
import { IPhysicalEntity } from "../entity";
import { IMediaInstance, Sound } from "@pixi/sound";
import { collisionGroupBitmask, CollisionGroups, GameWorld } from "../../world";
import {
  ActiveEvents,
  ColliderDesc,
  RigidBodyDesc,
  Vector2,
} from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from "../../utils/coodinate";
import { AssetPack } from "../../assets";
import { BitmapTerrain } from "../bitmapTerrain";
import { angleForVector } from "../../utils";
import { EntityType } from "../type";
import { WormInstance } from "../../logic";
import { ParticleTrail } from "../particletrail";
import { FireMarker } from "./fire";

const COLOUR_SET = [0x08ff08, 0xffcf00, 0xfe1493, 0xff5555, 0x00fdff, 0xccff02];

/**
 * Firework projectile.
 */
export class Firework extends TimedExplosive {
  public static readAssets(assets: AssetPack) {
    Firework.texture = assets.textures.firework;
    Firework.screamSound = assets.sounds.firework;
  }

  private static readonly collisionBitmask = collisionGroupBitmask(
    CollisionGroups.WorldObjects,
    [CollisionGroups.Terrain, CollisionGroups.WorldObjects],
  );
  private static texture: Texture;
  private static screamSound: Sound;
  private scream?: Promise<IMediaInstance>;

  priority = UPDATE_PRIORITY.LOW;

  static create(
    parent: Container,
    world: GameWorld,
    position: Coordinate,
    force: Vector2,
    owner?: WormInstance,
  ) {
    const ent = new Firework(position, world, parent, force, owner);
    parent.addChild(ent.sprite, ent.wireframe.renderable);
    parent.addChild(
      world.addEntity(ParticleTrail.create(ent.sprite.position, ent)).gfx,
    );
    return ent;
  }

  private constructor(
    position: Coordinate,
    world: GameWorld,
    parent: Container,
    initialForce: Vector2,
    owner?: WormInstance,
  ) {
    const sprite = new Sprite(Firework.texture);
    sprite.scale.set(0.1);
    sprite.anchor.set(0.5);

    const primaryColor =
      COLOUR_SET[Math.floor(Math.random() * COLOUR_SET.length)];
    const secondaryColor =
      COLOUR_SET[Math.floor(Math.random() * COLOUR_SET.length)];

    const body = world.createRigidBodyCollider(
      ColliderDesc.roundCuboid(0.05, 0.05, 0.5)
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(Firework.collisionBitmask)
        .setMass(0.5),
      RigidBodyDesc.dynamic()
        .setTranslation(position.worldX, position.worldY)
        .setLinvel(initialForce.x, initialForce.y)
        // Fix rot
        .setLinearDamping(1.5),
    );

    sprite.position = body.body.translation();
    super(sprite, body, world, parent, {
      explosionRadius: new MetersValue(2),
      explodeOnContact: true,
      explosionHue: primaryColor,
      explosionShrapnelHue: secondaryColor,
      timerSecs: 1.33,
      autostartTimer: true,
      maxDamage: 25,
      ownerWorm: owner,
    });
    this.rotationOffset = Math.PI / 2;
    this.scream = Promise.resolve(Firework.screamSound.play());
  }

  update(dt: number, dMs: number) {
    super.update(dt, dMs);
    if (!this.physObject || this.sprite.destroyed || this.isSinking) {
      return;
    }
    this.safeUsePhys(({ body }) => {
      body.setRotation(angleForVector(body.linvel()), false);
      this.wireframe.setDebugText(
        `${body.rotation()} ${Math.round(body.linvel().x)} ${Math.round(body.linvel().y)}`,
      );
    });
  }

  onExplode(): void {
    let rocketPos!: Coordinate;
    this.safeUsePhys(({ body }) => {
      rocketPos = Coordinate.fromWorld(body.translation());
    });
    super.onExplode();
    for (let index = 0; index < 10; index++) {
      const randomX = (Math.random() - 0.5) * 1;
      const pos = Coordinate.fromWorld(
        rocketPos.worldX + randomX,
        rocketPos.worldY - 1,
      );
      this.gameWorld.addEntity(
        new FireMarker(this.gameWorld, pos, this.parent, 5000),
      );
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
      return false;
    }
    return false;
  }

  recordState() {
    return {
      ...super.recordState(),
      type: EntityType.Firework,
    };
  }

  destroy(): void {
    super.destroy();
  }
}
