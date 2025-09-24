import { UPDATE_PRIORITY, Container, Texture } from "pixi.js";
import { IPhysicalEntity } from "../entity";
import { PhysicsEntity } from "./physicsEntity";
import { collisionGroupBitmask, CollisionGroups, GameWorld } from "../../world";
import {
  ActiveEvents,
  ColliderDesc,
  RigidBodyDesc,
  Vector2,
} from "@dimforge/rapier2d-compat";
import { add, Coordinate, MetersValue, randomChoice } from "../../utils";
import { AssetPack } from "../../assets";
import { EntityType } from "../type";
import { BaseRecordedState } from "../state/base";
import { ParsedTiledObject } from "../../levels/scenarioParser";
import { BitmapTerrain } from "../bitmapTerrain";
import Logger from "../../log";
import { ParticleTrail } from "../particletrail";
import { SequencedTiledSpriteAnimated } from "../../utils/tiledspriteanimated";
import { PlayableEntity } from "../playable/playable";
import { RecordedEntityState } from "../../state/model";

export class FireMarkerRecordedState extends BaseRecordedState {
  public readonly burnDuration: number;
  constructor(obj: Omit<ParsedTiledObject, "id" | "gid">) {
    super(obj);
    const burnDuration = obj.properties["burn_duration"] ?? 5;
    if (
      typeof burnDuration === "number" &&
      Number.isInteger(burnDuration) &&
      burnDuration > 0
    ) {
      this.burnDuration = burnDuration;
      return;
    }
    throw Error(`Invalid burnDuration on object, got '${burnDuration}'`);
  }
}

const fireDamageRadius = new MetersValue(0.25);
const logger = new Logger("Fire");
const burnEveryMs = 100;

const ParticleOpts = {
  colours: [
    {
      color: "rgba(107, 107, 107, 0.75)",
      chance: 1,
      size: 7,
    },
    {
      color: "rgba(190, 190, 190, 0.91)",
      chance: 1,
      size: 5,
    },
    {
      color: "rgba(133, 133, 133, 0.53)",
      chance: 1,
      size: 3,
    },
  ],
  initialSpeed: {
    x: 0,
    y: 0,
  },
  acceleration: {
    x: 0,
    y: -0.05,
  },
  offset: {
    x: 0,
    y: 5,
  },
};

/**
 *
 */
export class FireMarker extends PhysicsEntity<
  RecordedEntityState,
  SequencedTiledSpriteAnimated
> {
  public readonly type = EntityType.Target;
  private static readonly collisionBitmask = collisionGroupBitmask(
    CollisionGroups.Fire,
    [CollisionGroups.Terrain, CollisionGroups.Player],
  );
  private static readonly solverGroup = collisionGroupBitmask(
    CollisionGroups.Fire,
    [CollisionGroups.Terrain, CollisionGroups.Player],
  );
  public static readAssets({ textures }: AssetPack) {
    FireMarker.textureStart = textures.entity_fire_burningStart;
    FireMarker.textureEnd = textures.entity_fire_burningEnd;
    FireMarker.textureLoop = textures.entity_fire_burningLoop;
  }
  private static textureStart: Texture;
  private static textureEnd: Texture;
  private static textureLoop: Texture;
  private readonly trail: ParticleTrail;
  private remainingMs: number;

  private lastDamageMs = 0;
  private isFireStarting = true;

  public static loadFromRecordedState(
    parent: Container,
    gameWorld: GameWorld,
    state: FireMarkerRecordedState,
  ): FireMarker {
    return new FireMarker(
      gameWorld,
      Coordinate.fromScreen(state.tra.x, state.tra.y),
      parent,
      state.burnDuration * 1000,
    );
  }

  priority = UPDATE_PRIORITY.LOW;
  constructor(
    world: GameWorld,
    position: Coordinate,
    private readonly parent: Container,
    private readonly initialMs: number,
  ) {
    const sprite = new SequencedTiledSpriteAnimated(
      {
        columns: 8,
        width: 24,
        height: 32,
        fps: 15,
        tileCount: 4,
        anchor: { x: 0.5, y: 0.6 },
        scale: { x: 1.5, y: 1.5 },
        randomizeStartFrame: false, // Not for start.
      },
      [
        {
          texture: FireMarker.textureStart,
          tileCount: 4,
        },
        {
          texture: FireMarker.textureLoop,
          tileCount: 8,
          loop: true,
        },
        {
          texture: FireMarker.textureEnd,
          tileCount: 5,
        },
      ],
    );
    const body = world.createRigidBodyCollider(
      ColliderDesc.cuboid(0.35, 0.35)
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(FireMarker.collisionBitmask)
        .setSolverGroups(FireMarker.solverGroup),
      RigidBodyDesc.dynamic()
        .lockRotations()
        .setTranslation(position.worldX, position.worldY),
    );
    super(sprite, body, world);
    this.trail = ParticleTrail.create(sprite.position, this, ParticleOpts);
    this.wireframe.renderColor = "#d18a20";
    // a layer..
    this.parent.addChild(this.trail.gfx);
    this.parent.addChild(sprite);
    this.gameWorld.addBody(this, body.collider);
    this.gameWorld.addEntity(this.trail);
    this.remainingMs = this.initialMs;
  }

  update(_dt: number, dMs: number): void {
    // TODO: Randomness doesn't travel across network well!
    super.update(_dt, dMs);
    this.sprite.update(dMs);
    this.remainingMs -= dMs;
    this.lastDamageMs += dMs;
    if (this.remainingMs <= 0) {
      this.destroy();
      return;
    }
    const scale = Math.max(0.1, this.remainingMs / this.initialMs);
    this.sprite.scale.set(1.5 * scale);
    this.trail.scale = scale;
    if (this.lastDamageMs < burnEveryMs) {
      return;
    }
    if (scale < 0.25 && !this.sprite.hasNextAnimation) {
      this.sprite.loadNextAnim();
      // Don't perform damage below this level
      return;
    }
    this.lastDamageMs -= burnEveryMs;
    this.safeUsePhys(({ body }) => {
      if (body.isMoving()) {
        return;
      }
      logger.debug("Applying fire damange");
      const terrain = [...this.gameWorld.entities.values()].find(
        (v) => v instanceof BitmapTerrain,
      );
      const translation = body.translation();
      const burnAt = randomChoice([
        0.2 * scale,
        0.1 * scale,
        0.5 * scale,
        0,
        -0.5 * scale,
        -0.1 * scale,
        0.2 * scale,
      ]);
      terrain?.onDamage(
        add(translation, { x: burnAt, y: 0.5 }),
        fireDamageRadius.multiply(scale),
      );
    });
  }

  onCollision(otherEnt: IPhysicalEntity, contactPoint: Vector2) {
    if (super.onCollision(otherEnt, contactPoint)) {
      return true;
    }

    if (otherEnt instanceof PlayableEntity) {
      logger.debug("Player collided with fire");
      otherEnt.onDamage(contactPoint, fireDamageRadius, {
        forceMultiplier: 2,
        forceDamange: 3,
      });
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
