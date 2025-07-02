import { describe, expect, jest, test } from "@jest/globals";
import { CameraLockPriority, LockableEntity, ViewportCamera } from "../../src/camera";
import { Viewport } from "pixi-viewport";
import { MockViewport } from "../test-utils/viewport-mock";
import { MockPhysicsEntity } from "../test-utils/physent-mock";
import { MetersValue } from "../../src/utils";
import { BehaviorSubject, debounceTime, firstValueFrom, lastValueFrom, map, Observable } from "rxjs";


function createTestEnv() {
    const viewport = new MockViewport();
    const waterPosition = new MetersValue(30);
    const entities = new BehaviorSubject<LockableEntity[]>([]);
    const isLocalPlayer = new BehaviorSubject<boolean>(true);
    const camera = new ViewportCamera(viewport as unknown as Viewport, waterPosition, entities.pipe(map(e => new Set(e).values())), isLocalPlayer.asObservable());
    const lockTarget = getFinalValue(camera.lockTarget);
    return { viewport, camera, entities, isLocalPlayer, lockTarget };
}

function getFinalValue<T>(observable: Observable<T>): Promise<T> {
    // The camera itself debounces, so allow enough time.
    return firstValueFrom(observable.pipe(debounceTime(500)));
}

describe('ViewportCamera', () => {
    test('camera starts with nolock', async () => {
        const { lockTarget } = createTestEnv();
        expect(await lockTarget).toBeNull();
    });
    test('camera has nolock when no entities exist', async () => {
        const { entities, lockTarget } = createTestEnv();
        entities.next([]);
        expect(await lockTarget).toBeNull();
    });
    test('camera ignores targets with nolock', async () => {
        const { entities, lockTarget } = createTestEnv();
        const ent = new MockPhysicsEntity();
        ent.setCameraLock(CameraLockPriority.NoLock);
        entities.next([ent]);
        expect(await lockTarget).toBeNull();
    });
    test('camera locks onto a single target', async () => {
        const { viewport, camera, entities, lockTarget } = createTestEnv();
        const ent = new MockPhysicsEntity();
        ent.setCameraLock(CameraLockPriority.SuggestedLockLocal);
        entities.next([ent]);
        expect((await lockTarget)?.target).toEqual(ent);

        camera.update();
        expect(viewport.moveCenter).toHaveBeenCalledWith(ent.sprite.position.x, ent.sprite.position.y);
    });
    test('camera does not move if non-local lock', async () => {
        const { viewport, camera, entities, lockTarget } = createTestEnv();
        const ent = new MockPhysicsEntity();
        ent.setCameraLock(CameraLockPriority.SuggestedLockNonLocal);
        entities.next([ent]);
        expect((await lockTarget)?.target).toEqual(ent);

        camera.update();
        expect(viewport.moveCenter).not.toHaveBeenCalled();
    });

    test('camera ignores lock if user wants to move', async () => {
        const { viewport, camera, entities, lockTarget } = createTestEnv();
        const ent = new MockPhysicsEntity();
        ent.setCameraLock(CameraLockPriority.SuggestedLockLocal);
        entities.next([ent]);
        expect((await lockTarget)?.target).toEqual(ent);

        camera.update();
        expect(viewport.moveCenter).toHaveBeenCalledWith(ent.sprite.position.x, ent.sprite.position.y);

        viewport.emit('moved', { type: "test" });
        camera.update();
        // Ensure not called again
        expect(viewport.moveCenter).toHaveBeenCalledTimes(1);
    });
    test('camera moves to a higher priority target', async () => {
        const { viewport, camera, entities, lockTarget } = createTestEnv();
        const entLower = new MockPhysicsEntity();
        const entHigher = new MockPhysicsEntity();
        entLower.setCameraLock(CameraLockPriority.SuggestedLockLocal);
        entities.next([entLower, entHigher]);
        expect((await lockTarget)?.target).toBe(entLower);
        camera.update();
        expect(viewport.moveCenter).toHaveBeenCalledWith(entLower.sprite.position.x, entLower.sprite.position.y);

        const nextLockTarget = getFinalValue(camera.lockTarget);
        entHigher.setCameraLock(CameraLockPriority.LockIfNotLocalPlayer);
        expect((await nextLockTarget)?.target).toBe(entHigher);

        camera.update();
        expect(viewport.moveCenter).toHaveBeenCalledWith(entHigher.sprite.position.x, entHigher.sprite.position.y);
    });

    test('camera moves to a lower priority target when the higher cancels', async () => {
        const { viewport, camera, entities, lockTarget } = createTestEnv();
        const entLower = new MockPhysicsEntity();
        const entHigher = new MockPhysicsEntity();
        entLower.setCameraLock(CameraLockPriority.SuggestedLockLocal);
        entHigher.setCameraLock(CameraLockPriority.LockIfNotLocalPlayer);
        entities.next([entLower, entHigher]);
        expect((await lockTarget)?.target).toBe(entHigher);

        camera.update();
        expect(viewport.moveCenter).toHaveBeenCalledWith(entHigher.sprite.position.x, entHigher.sprite.position.y);

        const nextLockTarget = getFinalValue(camera.lockTarget);
        entHigher.setCameraLock(CameraLockPriority.NoLock);
        expect((await nextLockTarget)?.target).toEqual(entLower);
        camera.update();
        expect(viewport.moveCenter).toHaveBeenCalledWith(entLower.sprite.position.x, entLower.sprite.position.y);
    });
});