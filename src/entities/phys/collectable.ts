import { UPDATE_PRIORITY, Sprite, Container } from "pixi.js";
import { IPhysicalEntity } from "../entity";
import { PhysicsEntity } from "./physicsEntity";
import {
  collisionGroupBitmask,
  CollisionGroups,
  GameWorld,
  RapierPhysicsObject,
} from "../../world";
import {
  ActiveEvents,
  Collider,
  ColliderDesc,
  Vector2,
} from "@dimforge/rapier2d-compat";
import { RecordedEntityState } from "../../state/model";
import { PlayableEntity } from "../playable/playable";
import { MetersValue } from "../../utils";
import { BitmapTerrain } from "../bitmapTerrain";
import { handleDamageInRadius } from "../../utils/damage";

/**
 * An item collectable by a playable. On contact with a playable, it makes a change to that playable.
 */
export abstract class CollectableEntity<
  T extends RecordedEntityState = RecordedEntityState,
> extends PhysicsEntity<T> {
  priority = UPDATE_PRIORITY.LOW;

  private static readonly sensorCollisionBitmask = collisionGroupBitmask(
    CollisionGroups.WorldObjects,
    [CollisionGroups.Player],
  );
  sensor: Collider;

  constructor(
    sprite: Sprite,
    body: RapierPhysicsObject,
    gameWorld: GameWorld,
    private readonly parent: Container,
  ) {
    super(sprite, body, gameWorld);
    this.sensor = gameWorld.rapierWorld.createCollider(
      ColliderDesc.ball(new MetersValue(1.5).value)
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(CollectableEntity.sensorCollisionBitmask)
        .setSensor(true),
    );
    this.gameWorld.addBody(this, this.sensor);
    this.gameWorld.addBody(this, body.collider);
  }

  protected abstract onCollected(playable: PlayableEntity): void;

  update(_dt: number, _dMs: number): void {
    super.update(_dt, _dMs);
    this.sensor.setTranslation(this.physObject.body.translation());
  }

  onCollision(otherEnt: IPhysicalEntity, contactPoint: Vector2) {
    console.log("Health crate collision");
    if (super.onCollision(otherEnt, contactPoint)) {
      return true;
    }
    if (otherEnt instanceof BitmapTerrain || otherEnt === this) {
      // Meh.
      return false;
    }
    if (otherEnt instanceof PlayableEntity) {
      console.log("Deleted");
      this.onCollected(otherEnt);
      this.destroy();
    }

    return false;
  }

  public onDamage(): void {
    let position: Vector2;
    this.safeUsePhys(({ body }) => {
      position = body.translation();
      this.destroy();
    });
    handleDamageInRadius(
      this.gameWorld,
      this.parent,
      position!,
      new MetersValue(5),
      {
        maxDamage: 33,
      },
    );
  }

  public destroy(): void {
    super.destroy();
    this.gameWorld.rapierWorld.removeCollider(this.sensor, false);
  }

  recordState() {
    return {
      // No floats.
      ...super.recordState(),
    };
  }

  applyState(d: T) {
    super.applyState(d);
  }
}
