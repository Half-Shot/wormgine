import { ShapeContact, Vector2 } from "@dimforge/rapier2d";
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
    // TODO: Wrong shape?
    explodeHandler?: (point: Vector2, radius: number) => void;
    /**
     * 
     * @param other 
     * @param contactPoint 
     * @returns True if the collision should stop being processed
     */
    onCollision?(other: IMatterEntity, contactPoint: Vector2|null): boolean;
}

export interface IDamageableEntity {
    onDamage(point: Vector2, radius: MetersValue): void;
}