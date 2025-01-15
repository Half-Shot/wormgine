import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { TimedExplosive, TimedExplosiveRecordedState } from "./timedExplosive";
import { collisionGroupBitmask, CollisionGroups, GameWorld } from "../../world";
import {
  ActiveEvents,
  ColliderDesc,
  RigidBodyDesc,
  Vector2,
} from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from "../../utils/coodinate";
import { AssetPack } from "../../assets";
import { WormInstance } from "../../logic/teams";
import { angleForVector, mult } from "../../utils";
import { EntityType } from "../type";
import Logger from "../../log";
import globalFlags, { DebugLevel } from "../../flags";
import { arcPoints } from "../../utils/arc";

const logger = new Logger("HomingMissile");

const ACTIVATION_TIME_MS = 65;
const ADJUSTMENT_TIME_MS = 6;
const forceMult = new Vector2(7, 7);

export interface HomingMissileRecordedState extends TimedExplosiveRecordedState {
  target: {
    x: number;
    y: number;
  }
  hasActivated: boolean;
}


/**
 * Homing missile that attempts to hit a point target.
 */
export class HomingMissile extends TimedExplosive {
  public static getMissilePath(
    start: Coordinate,
    target: Coordinate,
  ): Coordinate[] {
    return arcPoints(
      [start.worldX, start.worldY],
      [target.worldX, target.worldY],
      0.55,
    ).map((v) => Coordinate.fromWorld(v[0], v[1]));
  }

  public static readAssets(assets: AssetPack) {
    HomingMissile.textureInactive = assets.textures.missileInactive;
    HomingMissile.textureActive = assets.textures.missileActive;
  }

  private static readonly collisionBitmask = collisionGroupBitmask(
    CollisionGroups.WorldObjects,
    [CollisionGroups.Terrain, CollisionGroups.WorldObjects],
  );
  private static textureInactive: Texture;
  private static textureActive: Texture;
  private forcePath: Coordinate[] = [];
  private readonly debugGfx = new Graphics();
  private lastPathAdjustment = 0;
  private hasActivated = false;

  static create(
    parent: Container,
    gameWorld: GameWorld,
    position: Coordinate,
    force: Vector2,
    target: Coordinate,
    owner?: WormInstance,
  ) {
    const ent = new HomingMissile(
      position,
      gameWorld,
      parent,
      force,
      target,
      owner,
    );
    gameWorld.addBody(ent, ent.physObject.collider);
    parent.addChild(ent.sprite);
    parent.addChild(ent.wireframe.renderable);
    parent.addChild(ent.debugGfx);
    return ent;
  }

  private constructor(
    position: Coordinate,
    world: GameWorld,
    parent: Container,
    initialForce: Vector2,
    private target: Coordinate,
    owner?: WormInstance,
  ) {
    const sprite = new Sprite(HomingMissile.textureInactive);
    const body = world.createRigidBodyCollider(
      ColliderDesc.cuboid(0.5, 0.2)
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(HomingMissile.collisionBitmask)
        .setSolverGroups(HomingMissile.collisionBitmask)
        .setMass(1),
      // TODO: Angle rotation the right way.
      RigidBodyDesc.dynamic()
        .setTranslation(position.worldX, position.worldY)
        .setLinvel(initialForce.x, initialForce.y)
        // TODO: Check
        // TODO: Friction
        .setLinearDamping(0.05),
    );

    super(sprite, body, world, parent, {
      explosionRadius: new MetersValue(2.25),
      explodeOnContact: true,
      timerSecs: 30,
      autostartTimer: true,
      ownerWorm: owner,
      maxDamage: 45,
    });
    this.debugGfx.visible = globalFlags.DebugView === DebugLevel.BasicOverlay;
    globalFlags.on(
      "toggleDebugView",
      (debug) => (this.debugGfx.visible = debug === DebugLevel.BasicOverlay),
    );
    this.sprite.x = position.screenX;
    this.sprite.y = position.screenY;
    this.sprite.scale.set(0.75, 0.75);
    this.sprite.anchor.set(0.5, 0.5);

    // Align sprite with body.
    this.rotationOffset = Math.PI / 2;
    logger.debug(`pos: ${position}`, `target: ${target}`);
  }

  update(dt: number): void {
    super.update(dt);
    if (!this.physObject || this.sprite.destroyed) {
      return;
    }
    this.lastPathAdjustment += dt;

    if (!this.hasActivated && this.lastPathAdjustment >= ACTIVATION_TIME_MS) {
      this.hasActivated = true;
      const { target } = this;
      const { position } = this.sprite;
      this.sprite.texture = HomingMissile.textureActive;
      this.forcePath = HomingMissile.getMissilePath(
        Coordinate.fromScreen(position.x, position.y),
        target,
      );
      // Draw paths once
      const start = this.forcePath.pop()!;
      this.debugGfx.moveTo(start.screenX, start.screenY);
      for (const point of this.forcePath) {
        this.debugGfx
          .lineTo(point.screenX, point.screenY)
          .stroke({ width: 5, color: 0xffbd01, alpha: 1 });
      }
      logger.debug("Activated!");
    }

    if (this.hasActivated && this.lastPathAdjustment >= ADJUSTMENT_TIME_MS) {
      this.lastPathAdjustment = 0;
      const [nextOrLastItem] = this.forcePath.splice(0, 1);
      if (nextOrLastItem) {
        const translation = this.body.translation();
        const impulse = mult(
          new Vector2(
            nextOrLastItem.worldX - translation.x,
            nextOrLastItem.worldY - translation.y,
          ),
          forceMult,
        );
        this.body.setLinvel(impulse, true);
      }
    }
    this.body.setRotation(angleForVector(this.body.linvel()), false);
    this.wireframe.setDebugText(
      `${this.lastPathAdjustment}t ${this.body.rotation()}  ${Math.round(this.body.linvel().x)} ${Math.round(this.body.linvel().y)} ${this.hasActivated ? "act" : "noact"}`,
    );
  }

  destroy(): void {
    super.destroy();
    this.debugGfx.destroy();
  }

  recordState() {
    return {
      ...super.recordState(),
      target: {
        x: this.target.worldX,
        y: this.target.worldY,
      },
      hasActivated: this.hasActivated,
      type: EntityType.HomingMissile,
    };
  }

  loadState(d: HomingMissileRecordedState): void {
    if (!this.hasActivated) {
      this.hasActivated = d.hasActivated;
    }
    const newTarget = Coordinate.fromWorld(d.target.x, d.target.y);
    if (this.target.hash() !== newTarget.hash()) {
      logger.info("Missle course adjusted by network sync");
      this.target = newTarget;
      const { position } = this.sprite;
      this.forcePath = HomingMissile.getMissilePath(
        Coordinate.fromScreen(position.x, position.y),
        newTarget,
      );
    }
  }
}
