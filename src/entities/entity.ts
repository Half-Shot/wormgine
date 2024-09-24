import { ShapeContact, Vector2 } from "@dimforge/rapier2d-compat";
import { Point, UPDATE_PRIORITY } from "pixi.js";
import { MetersValue } from "../utils";

/**
 * Base entity which all game objects implement
 */
export interface IGameEntity {

    priority: UPDATE_PRIORITY;
    destroyed: boolean;

    update?(dt: number): void;
    destroy(): void;
}

/**
 * Any entity that has an attached Matter body will use this
 * interface.
 */
export interface IMatterEntity extends IGameEntity {
    /**
     * 
     * @param other 
     * @param contactPoint 
     * @returns True if the collision should stop being processed
     */
    onCollision?(other: IMatterEntity, contactPoint: Vector2|null): boolean;

    /**
     * Called when another entity has damaged this entity.
     * 
     * @param point The point from where the damage originates.
     * @param radius The radius of the explosion. 
     */
    onDamage?(point: Vector2, radius: MetersValue): void
}