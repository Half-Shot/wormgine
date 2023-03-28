import { Container, UPDATE_PRIORITY } from "pixi.js";
import { Body, Contact } from "matter-js";

export interface IGameEntity {

    priority: UPDATE_PRIORITY;
    destroyed: boolean;

    create(parent: Container, composite: Matter.Composite): PromiseLike<void>;
    update?(dt: number): void;
    destroy(): void;
}

export interface IMatterEntity extends IGameEntity {
    bodies: Body[];
    onCollision?(other: IMatterEntity, contactPoint: Contact): void;
}