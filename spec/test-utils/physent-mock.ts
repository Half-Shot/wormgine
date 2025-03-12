import { jest } from "@jest/globals";
import { PhysicsEntity } from "../../src/entities/phys/physicsEntity";
import { RapierPhysicsObject } from "../../src/world";
import { Collider, Cuboid } from "@dimforge/rapier2d-compat";
import { Point, Sprite } from "pixi.js";
import { CameraLockPriority } from "../../src/camera";

export class MockPhysicsEntity extends PhysicsEntity {

    public mockSprite: Sprite;

    constructor(position?: Point) {
        const mockSprite = {
            position: position ?? new Point(Math.ceil(Math.random() * 100), Math.ceil(Math.random() * 100))
        } as Sprite;
        super(mockSprite, jest.mocked<Partial<RapierPhysicsObject>>({
            collider: {
                shape: new Cuboid(5,5)
            } as Partial<Collider> as Collider,
        }) as RapierPhysicsObject, { } as any);
        this.mockSprite = mockSprite;
    }

    public setCameraLock(cameraLockPriority: CameraLockPriority) {
        this.desiredCameraLockPriority.next(cameraLockPriority);
    }

    public destroy(): void {
        // Does nothing.
    }
    
    public toString() {
        return "MockPhysObject";
    }
}