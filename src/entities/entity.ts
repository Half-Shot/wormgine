import { RigidBody, Vector2 } from "@dimforge/rapier2d-compat";
import { UPDATE_PRIORITY } from "pixi.js";
import { MetersValue } from "../utils";
import { EntityType } from "./type";

/**
 * Base entity which all game objects implement
 */
export interface IGameEntity {
  type?: EntityType;
  priority: UPDATE_PRIORITY;
  destroyed: boolean;

  update?(dt: number, dMs: number): void;
  destroy(): void;
}

export interface OnDamageOpts {
  maxDamage?: number;
}

/**
 * Any entity that has attached bodies in the game. Unlike `physicsEntity` which
 * may be attached to one sprite and can be affected by other entites, this interface
 * merely provides functions for collisions and damage.
 *
 * For instance, this may be used for terrain.
 */
export interface IPhysicalEntity extends IGameEntity {
  body?: RigidBody;

  /**
   * Override flag to mark the entity as active when it is otherwise not moving.
   */
  consideredActive?: boolean;

  /**
   *
   * @param other
   * @param contactPoint
   * @returns True if the collision should stop being processed
   */
  onCollision?(other: IPhysicalEntity, contactPoint: Vector2 | null): boolean;

  /**
   * Called when another entity has damaged this entity.
   *
   * @param point The point from where the damage originates.
   * @param radius The radius of the explosion.
   */
  onDamage?(point: Vector2, radius: MetersValue, opts: OnDamageOpts): void;
}
