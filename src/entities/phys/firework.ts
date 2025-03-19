import {
  Color,
  Container,
  Graphics,
  Point,
  Sprite,
  Texture,
  UPDATE_PRIORITY,
} from "pixi.js";
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
    const trail = ParticleTrail.create(parent, ent.sprite.position, ent);
    world.addEntity(trail);
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
    sprite.scale.set(0.15);
    sprite.anchor.set(0.5);

    const primaryColor =
      COLOUR_SET[Math.floor(Math.random() * COLOUR_SET.length)];
    const secondaryColor =
      COLOUR_SET[Math.floor(Math.random() * COLOUR_SET.length)];

    const body = world.createRigidBodyCollider(
      ColliderDesc.roundCuboid(0.05, 0.05, 0.5)
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(Firework.collisionBitmask)
        .setSolverGroups(Firework.collisionBitmask)
        .setMass(0.5),
      RigidBodyDesc.dynamic()
        .setTranslation(position.worldX, position.worldY)
        .setLinvel(initialForce.x, initialForce.y)
        // Fix rot
        .setLinearDamping(1.5),
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
