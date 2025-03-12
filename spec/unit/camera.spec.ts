import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { CameraLockPriority, ViewportCamera } from "../../src/camera";
import { Viewport } from "pixi-viewport";
import { MockViewport } from "../test-utils/viewport-mock";
import { MockPhysicsEntity } from "../test-utils/physent-mock";
import { MetersValue } from "../../src/utils";
import { BehaviorSubject, map } from "rxjs";
import { PhysicsEntity } from "../../src/entities/phys/physicsEntity";


function createTestEnv() {
    const viewport = new MockViewport();
    const waterPosition = new MetersValue(30);
    const entities = new BehaviorSubject<PhysicsEntity[]>([]);
    const isLocalPlayer = new BehaviorSubject<boolean>(true);
    const camera = new ViewportCamera(viewport as unknown as Viewport, waterPosition, entities.pipe(map(e => new Set(e).values())), isLocalPlayer.asObservable());
    return { viewport, camera, entities, isLocalPlayer };
}

describe('ViewportCamera', () => {
    beforeEach(() =>{
        jest.useFakeTimers();
    })

    test('camera starts with nolock', () => {
        const { camera, entities } = createTestEnv();
        entities.next([]);
        jest.runAllTimers();
        expect(camera.lockTarget).toBeNull();
    });
    test('camera ignores targets with nolock', () => {
        const { camera, entities } = createTestEnv();
        const ent = new MockPhysicsEntity();
        ent.setCameraLock(CameraLockPriority.NoLock);
        entities.next([ent]);
        jest.runAllTimers();
        expect(camera.lockTarget).toBeNull();
    });
    test('camera locks onto a single target', () => {
        const { viewport, camera, entities } = createTestEnv();
        const ent = new MockPhysicsEntity();
        ent.setCameraLock(CameraLockPriority.SuggestedLockLocal);
        entities.next([ent]);
        jest.runAllTimers();
        camera.update();
        expect(camera.lockTarget).toBe(ent);
        expect(viewport.moveCenter).toHaveBeenCalledWith(ent.sprite.position.x, ent.sprite.position.y);
    });
    test('camera does not move if non-local lock', () => {
        const { viewport, camera, entities } = createTestEnv();
        const ent = new MockPhysicsEntity();
        ent.setCameraLock(CameraLockPriority.SuggestedLockNonLocal);
        entities.next([ent]);
        jest.runAllTimers();
        camera.update();
        expect(camera.lockTarget).toBe(ent);
        expect(viewport.moveCenter).not.toHaveBeenCalled();
    });
    test('camera ignores lock if user wants to move', () => {
        const { viewport, camera, entities } = createTestEnv();
        const ent = new MockPhysicsEntity();
        ent.setCameraLock(CameraLockPriority.SuggestedLockLocal);
        entities.next([ent]);
        jest.runAllTimers();
        camera.update();
        expect(camera.lockTarget).toBe(ent);
        expect(viewport.moveCenter).toHaveBeenCalledWith(ent.sprite.position.x, ent.sprite.position.y);
        viewport.emit('moved', { type: "test" });
        camera.update();
        // Ensure not recalled.
        expect(viewport.moveCenter).toHaveBeenCalledTimes(1);
    });
    test('camera moves to a higher priority target', () => {
        const { viewport, camera, entities } = createTestEnv();
        const entLower = new MockPhysicsEntity();
        const entHigher = new MockPhysicsEntity();
        entLower.setCameraLock(CameraLockPriority.SuggestedLockLocal);
        entities.next([entLower, entHigher]);
        jest.runAllTimers();
        camera.update();
        expect(camera.lockTarget).toBe(entLower);
        expect(viewport.moveCenter).toHaveBeenCalledWith(entLower.sprite.position.x, entLower.sprite.position.y);
        entHigher.setCameraLock(CameraLockPriority.LockIfNotLocalPlayer);
        camera.update();
        expect(camera.lockTarget).toBe(entHigher);
        expect(viewport.moveCenter).toHaveBeenCalledWith(entHigher.sprite.position.x, entHigher.sprite.position.y);
    });
    test('camera moves to a lower priority target when the higher cancels', () => {
        const { viewport, camera, entities } = createTestEnv();
        const entLower = new MockPhysicsEntity();
        const entHigher = new MockPhysicsEntity();
        entLower.setCameraLock(CameraLockPriority.SuggestedLockLocal);
        entHigher.setCameraLock(CameraLockPriority.LockIfNotLocalPlayer);
        entities.next([entLower, entHigher]);
        jest.runAllTimers();
        camera.update();
        expect(camera.lockTarget).toBe(entHigher);
        expect(viewport.moveCenter).toHaveBeenCalledWith(entHigher.sprite.position.x, entHigher.sprite.position.y);
        entHigher.setCameraLock(CameraLockPriority.NoLock);
        jest.runAllTimers();
        camera.update();
        // FIXME: .toBe throws with `ReferenceError: document is not defined`
        expect(camera.lockTarget === entLower).toEqual(true);
        expect(viewport.moveCenter).toHaveBeenCalledWith(entLower.sprite.position.x, entLower.sprite.position.y);
    });
});