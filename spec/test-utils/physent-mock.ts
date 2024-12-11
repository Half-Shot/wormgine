import { jest } from "@jest/globals";
import { PhysicsEntity } from "../../src/entities/phys/physicsEntity";
import { GameWorld, RapierPhysicsObject } from "../../src/world";
import { Collider, Cuboid } from "@dimforge/rapier2d-compat";
import { Point, Sprite } from "pixi.js";

export class MockPhysicsEntity extends PhysicsEntity {

    public mockSprite: Sprite;

    constructor(world: GameWorld, position?: Point) {
        const mockSprite = {
            position: position ?? new Point(Math.ceil(Math.random() * 100), Math.ceil(Math.random() * 100))
        } as Sprite;
        super(mockSprite, jest.mocked<Partial<RapierPhysicsObject>>({
            collider: {
                shape: new Cuboid(5,5)
            } as Partial<Collider> as Collider,
        }) as RapierPhysicsObject, world);
        this.mockSprite = mockSprite;
    }
    
    public toString() {
        return "MockPhysObject";
    }
}