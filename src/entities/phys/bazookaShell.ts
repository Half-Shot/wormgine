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
import { WormInstance } from "../../logic";
import { angleForVector } from "../../utils";
import { EntityType } from "../type";
import { ParticleTrail } from "../particletrail";

/**
 * Standard shell, affected by wind.
 */
export class BazookaShell extends TimedExplosive {
  public static loadFromRecordedState(
    parent: Container,
    gameWorld: GameWorld,
    state: TimedExplosiveRecordedState,
  ) {
    BazookaShell.create(
      parent,
      gameWorld,
      Coordinate.fromWorld(new Vector2(state.tra.x, state.tra.y)),
      new Vector2(0, 0),
    );
  }

  public static readAssets(assets: AssetPack) {
    BazookaShell.texture = assets.textures.bazooka;
  }

  private static readonly collisionBitmask = collisionGroupBitmask(
    CollisionGroups.WorldObjects,
    [CollisionGroups.Terrain, CollisionGroups.WorldObjects],
  );
  private static texture: Texture;
  private readonly gfx = new Graphics();

  static create(
    parent: Container,
    gameWorld: GameWorld,
    position: Coordinate,
    force: Vector2,
    owner?: WormInstance,
  ) {
    const ent = new BazookaShell(position, gameWorld, parent, force, owner);
    gameWorld.addBody(ent, ent.physObject.collider);
    gameWorld.addEntity(ParticleTrail.create(parent, ent.sprite.position, ent));
    parent.addChild(ent.sprite);
    parent.addChild(ent.wireframe.renderable);
    return ent;
  }

  private constructor(
    position: Coordinate,
    world: GameWorld,
    parent: Container,
    initialForce: Vector2,
    owner?: WormInstance,
  ) {
    const sprite = new Sprite(BazookaShell.texture);
    const body = world.createRigidBodyCollider(
      ColliderDesc.cuboid(0.5, 0.2)
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(BazookaShell.collisionBitmask)
        .setSolverGroups(BazookaShell.collisionBitmask)
        .setMass(1),
      // TODO: Angle rotation the right way.
      RigidBodyDesc.dynamic()
        .setTranslation(position.worldX, position.worldY)
        .setLinvel(initialForce.x, initialForce.y)
        // TODO: Check
        // TODO: Friction
        .setLinearDamping(0.05),
    );
    body.body.addForce({ x: world.wind * 1.25, y: 0 }, false);

    super(sprite, body, world, parent, {
      explosionRadius: new MetersValue(2.75),
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

    // Align sprite with body.
    this.rotationOffset = Math.PI / 2;
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

  destroy(): void {
    super.destroy();
    this.gfx.destroy();
  }

  recordState() {
    return {
      ...super.recordState(),
      type: EntityType.BazookaShell,
    };
  }
}
