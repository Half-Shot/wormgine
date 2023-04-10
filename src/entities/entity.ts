import { UPDATE_PRIORITY } from "pixi.js";
import { Vector } from "matter-js";

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
    explodeHandler?: (point: Vector, radius: number) => void;
    entityOwnsBody(bodyId: number): boolean;
    /**
     * 
     * @param other 
     * @param contactPoint 
     * @returns True if the collision should stop being processed
     */
    onCollision?(other: IMatterEntity, contactPoint: Vector): boolean;
}