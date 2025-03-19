import { Container, Sprite, Text, Texture, Ticker } from "pixi.js";
import { TimedExplosive, TimedExplosiveOpts } from "./timedExplosive";
import { IPhysicalEntity } from "../entity";
import { BitmapTerrain } from "../bitmapTerrain";
import { IMediaInstance, Sound } from "@pixi/sound";
import { collisionGroupBitmask, CollisionGroups, GameWorld } from "../../world";
import {
  ActiveEvents,
  ColliderDesc,
  RigidBodyDesc,
  Vector2,
} from "@dimforge/rapier2d-compat";
import { magnitude } from "../../utils";
import { Coordinate, MetersValue } from "../../utils/coodinate";
import { AssetPack } from "../../assets";
import { DefaultTextStyle } from "../../mixins/styles";
import { WormInstance } from "../../logic";
import { EntityType } from "../type";
import { PlayableEntity } from "../playable/playable";

/**
 * Grenade projectile.
 */
export class Grenade extends TimedExplosive {
  public static readAssets({ textures, sounds }: AssetPack) {
    Grenade.texture = textures.grenade;
    Grenade.bounceSoundsLight = sounds.metalBounceLight;
    Grenade.boundSoundHeavy = sounds.metalBounceHeavy;
  }

  private static readonly collisionBitmask = collisionGroupBitmask(
    CollisionGroups.WorldObjects,
    [CollisionGroups.Terrain, CollisionGroups.WorldObjects],
  );
  private static texture: Texture;
  private static bounceSoundsLight: Sound;
  private static boundSoundHeavy: Sound;

  static create(
    parent: Container,
    world: GameWorld,
    position: Coordinate,
    initialForce: { x: number; y: number },
    timerSecs = 3,
    worm?: WormInstance,
  ) {
    const ent = new Grenade(
      position,
      initialForce,
      world,
      parent,
      timerSecs,
      worm,
    );
    parent.addChild(ent.sprite, ent.wireframe.renderable);
    return ent;
  }

  private timerText: Text;

  private get timerTextValue() {
    return `${((this.timer ?? 0) / (Ticker.targetFPMS * 1000)).toFixed(1)}`;
  }
  public bounceSoundPlayback?: IMediaInstance;

  protected constructor(
    position: Coordinate,
    initialForce: { x: number; y: number },
    world: GameWorld,
    parent: Container,
    timerSecs: number,
    owner?: WormInstance,
    optsOverrides?: Partial<TimedExplosiveOpts>,
    textureOverride?: Texture,
    scaleOverride?: number,
  ) {
    const sprite = new Sprite(textureOverride ?? Grenade.texture);
    sprite.scale.set(scaleOverride ? scaleOverride : 0.5);
    sprite.anchor.set(0.5);
    const body = world.createRigidBodyCollider(
      ColliderDesc.roundCuboid(0.05, 0.05, 0.5)
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(Grenade.collisionBitmask)
        .setSolverGroups(Grenade.collisionBitmask)
        .setMass(0.1),
      RigidBodyDesc.dynamic().setTranslation(position.worldX, position.worldY),
    );
    sprite.position = body.body.translation();
    super(sprite, body, world, parent, {
      explosionRadius: new MetersValue(2.25),
      explodeOnContact: false,
      timerSecs,
      autostartTimer: true,
      ownerWorm: owner,
      maxDamage: 35,
      forceMultiplier: 0.25,
      ...optsOverrides,
    });
    this.timerText = new Text({
      text: "",
      style: {
        ...DefaultTextStyle,
        align: "center",
      },
    });
    this.sprite.addChild(this.timerText);
    this.body.setLinvel(initialForce, true);
  }

  update(dt: number, dMs: number) {
    super.update(dt, dMs);
    if (this.sprite.destroyed || this.isSinking) {
      return;
    }

    this.wireframe.setDebugText(
      `velocity: ${Math.round(magnitude(this.physObject.body.linvel()) * 1000) / 1000}`,
    );

    if (!this.timerText.destroyed) {
      this.timerText.rotation = -this.physObject.body.rotation();
      this.timerText.text = this.timerTextValue;
    }
  }

  onCollision(otherEnt: IPhysicalEntity, contactPoint: Vector2) {
    if (super.onCollision(otherEnt, contactPoint)) {
      this.timerText.destroy();
      return true;
    }
    if (otherEnt instanceof PlayableEntity) {
      this.safeUsePhys(({body}) => {
        body.collider(0).setFriction(0.95);
      })
    }
    // We don't explode, but we do make a noise.
    if (otherEnt instanceof BitmapTerrain === false) {
      return false;
    }

    const velocity = magnitude(this.physObject.body.linvel());

    // TODO: can these interrupt?
    if (
      !this.bounceSoundPlayback?.progress ||
      (this.bounceSoundPlayback.progress === 1 && this.timer)
    ) {
      // TODO: Hacks
      Promise.resolve(
        (velocity >= 8
          ? Grenade.boundSoundHeavy
          : Grenade.bounceSoundsLight
        ).play(),
      ).then((instance) => {
        this.bounceSoundPlayback = instance;
      });
    }
    return false;
  }

  recordState() {
    return {
      ...super.recordState(),
      type: EntityType.Grenade,
    };
  }

  destroy(): void {
    super.destroy();
  }
}
