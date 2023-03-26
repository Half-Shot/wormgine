import { Container, UPDATE_PRIORITY } from "pixi.js";

export interface IGameEntity {

    priority: UPDATE_PRIORITY;
    destroyed: boolean;

    create(parent: Container, composite: Matter.Composite): PromiseLike<void>;
    update?(dt: number): void;
    destroy(): void;
}