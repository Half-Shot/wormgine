import { UPDATE_PRIORITY, Sprite, Container, Texture } from "pixi.js";
import { IPhysicalEntity } from "../entity";
import { PhysicsEntity } from "./physicsEntity";
import { collisionGroupBitmask, CollisionGroups, GameWorld } from "../../world";
import {
  ActiveEvents,
  ColliderDesc,
  RigidBodyDesc,
  Vector2,
} from "@dimforge/rapier2d-compat";
import { handleDamageInRadius } from "../../utils/damage";
import { Coordinate, MetersValue } from "../../utils";
import { Worm } from "../playable/worm";
import { BitmapTerrain } from "../bitmapTerrain";
import { AssetPack } from "../../assets";
import { EntityType } from "../type";

interface Opts {
  explosionRadius?: MetersValue;
  explosionHue?: number;
  explosionShrapnelHue?: number;
}

/**
 * Any projectile type that can explode after a set timer. Implementing classes
 * must include their own timer.
 */
export class WeaponTarget extends PhysicsEntity {
  public readonly type = EntityType.Target;
  private static readonly collisionBitmask = collisionGroupBitmask(
    CollisionGroups.WorldObjects,
    [CollisionGroups.Terrain, CollisionGroups.WorldObjects],
  );
  public static readAssets({ textures }: AssetPack) {
    WeaponTarget.texture = textures.target;
  }
  private static texture: Texture;

  private hasExploded = false;

  priority = UPDATE_PRIORITY.LOW;
  constructor(
    world: GameWorld,
    position: Coordinate,
    private readonly parent: Container,
    private readonly opts: Opts = {},
  ) {
    const sprite = new Sprite(WeaponTarget.texture);
    sprite.scale.set(1);
    sprite.anchor.set(0.5);
    const body = world.createRigidBodyCollider(
      ColliderDesc.ball(1)
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(WeaponTarget.collisionBitmask)
        .setSolverGroups(WeaponTarget.collisionBitmask),
      RigidBodyDesc.fixed().setTranslation(position.worldX, position.worldY),
    );
    super(sprite, body, world);
    this.gameWorld.addBody(this, body.collider);
  }

  onDamage(): void {
    this.onExplode();
  }

  onExplode() {
    if (this.hasExploded) {
      throw Error("Tried to explode twice");
    }
    this.hasExploded = true;
    handleDamageInRadius(
      this.gameWorld,
      this.parent,
      this.body.translation(),
      this.opts.explosionRadius ?? new MetersValue(2),
      {
        shrapnelMax: 35,
        shrapnelMin: 15,
        hue: this.opts.explosionHue ?? 0xffffff,
        shrapnelHue: this.opts.explosionShrapnelHue ?? 0xffffff,
        maxDamage: 0,
      },
      this.physObject.collider,
    );
    this.destroy();
  }

  onCollision(otherEnt: IPhysicalEntity, contactPoint: Vector2) {
    if (super.onCollision(otherEnt, contactPoint)) {
      return true;
    }

    return false;
  }

  recordState() {
    return {
      ...super.recordState(),
    };
  }
}
