import { Container, UPDATE_PRIORITY } from "pixi.js";
import { Body, Contact, Vector } from "matter-js";

export interface IGameEntity {

    priority: UPDATE_PRIORITY;
    destroyed: boolean;

    update?(dt: number): void;
    destroy(): void;
}

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