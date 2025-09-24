import {
  ActiveEvents,
  ColliderDesc,
  RigidBodyDesc,
} from "@dimforge/rapier2d-compat";
import { Container, Texture, Sprite } from "pixi.js";
import { AssetPack } from "../../../assets";
import { Coordinate } from "../../../utils";
import {
  collisionGroupBitmask,
  CollisionGroups,
  GameWorld,
} from "../../../world";
import { PlayableEntity } from "../../playable/playable";
import { CollectableEntity } from "../collectable";
import { BaseRecordedState } from "../../state/base";
import { ParsedTiledObject } from "../../../levels/scenarioParser";
import { RecordedEntityState } from "../../../state/model";

export class HealthCrateRecordedState
  extends BaseRecordedState
  implements RecordedEntityState
{
  public readonly health: number;
  constructor(obj: Omit<ParsedTiledObject, "id" | "gid">) {
    super(obj);
    const health = obj.properties["health"];
    if (typeof health === "number" && Number.isInteger(health) && health > 0) {
      this.health = health;
      return;
    }
    throw Error(`Invalid healthAmount on object, got '${health}'`);
  }
}

export class HealthCrate extends CollectableEntity<HealthCrateRecordedState> {
  public static loadFromRecordedState(
    parent: Container,
    gameWorld: GameWorld,
    state: HealthCrateRecordedState,
  ): HealthCrate {
    return HealthCrate.create(
      parent,
      gameWorld,
      Coordinate.fromScreen(state.tra.x, state.tra.y),
      state.health,
    );
  }

  public static readAssets(assets: AssetPack) {
    HealthCrate.texture = assets.textures.bazooka;
  }

  private static readonly collisionBitmask = collisionGroupBitmask(
    CollisionGroups.WorldObjects,
    [CollisionGroups.Terrain],
  );
  private static texture: Texture;

  static create(
    parent: Container,
    gameWorld: GameWorld,
    position: Coordinate,
    health: number,
  ) {
    const ent = new HealthCrate(gameWorld, position, parent, health);
    gameWorld.addBody(ent, ent.physObject.collider);
    parent.addChild(ent.sprite);
    parent.addChild(ent.wireframe.renderable);
    return ent;
  }

  constructor(
    gameWorld: GameWorld,
    position: Coordinate,
    parent: Container,
    public readonly health: number,
  ) {
    const sprite = new Sprite(HealthCrate.texture);
    sprite.scale.set(0.5);
    sprite.anchor.set(0.5);
    const body = gameWorld.createRigidBodyCollider(
      ColliderDesc.roundCuboid(0.05, 0.05, 0.5)
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(HealthCrate.collisionBitmask)
        .setMass(0.1),
      RigidBodyDesc.dynamic()
        .setTranslation(position.worldX, position.worldY)
        .lockRotations(),
    );
    console.log(position.worldX, position.worldY);
    sprite.position = body.body.translation();
    super(sprite, body, gameWorld, parent);
  }

  public onCollected(playable: PlayableEntity): void {
    playable.wormIdent.setHealth(playable.wormIdent.health + this.health);
  }
}
