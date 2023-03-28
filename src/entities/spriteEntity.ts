import Matter, { Composite } from "matter-js";
import { Container, Sprite, Texture, UPDATE_PRIORITY } from "pixi.js";
import { IGameEntity } from "./entity";

export abstract class SpriteEntity implements IGameEntity {

    protected readonly sprite: Sprite;

    public readonly priority: UPDATE_PRIORITY = UPDATE_PRIORITY.NORMAL;

    public get destroyed() {
        return this.sprite.destroyed;
    }

    constructor(texture: Texture) {
        this.sprite = new Sprite(texture);
    }

    async create(parent: Container, engine: Composite) {
        parent.addChild(this.sprite);
    }

    destroy(): void {
        this.sprite.destroy();
    }
}