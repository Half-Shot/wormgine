import { describe, expect, jest, test } from "@jest/globals";
import { CameraLockPriority, ViewportCamera } from "../../src/camera";
import { Viewport } from "pixi-viewport";
import { GameWorld } from "../../src/world";
import { Ticker } from "pixi.js";
import { MockViewport } from "../test-utils/viewport-mock";
import { MockPhysicsEntity } from "../test-utils/physent-mock";
import { MetersValue } from "../../src/utils";


function createTestEnv() {
    const viewport = new MockViewport();
    const gameWorld = jest.mocked<Partial<GameWorld>>({
        entities: new Map(),
    });
    const waterPosition = new MetersValue(30);
    const camera = new ViewportCamera(viewport as unknown as Viewport, gameWorld as GameWorld, waterPosition);
    return { viewport, camera, gameWorld };
}

describe('ViewportCamera', () => {
    test('camera starts with nolock', () => {
        const { camera } = createTestEnv();
        camera.update(new Ticker(), undefined);
        expect(camera.lockTarget).toBeNull();
    });
    test('camera ignores targets with nolock', () => {
        const { camera, gameWorld } = createTestEnv();
        const ent = new MockPhysicsEntity(gameWorld as GameWorld);
        ent.cameraLockPriority = CameraLockPriority.NoLock;
        gameWorld.entities?.set('foobar', ent);
        camera.update(new Ticker(), undefined);
        expect(camera.lockTarget).toBeNull();
    });
    test('camera locks onto a single target', () => {
        const { viewport, camera, gameWorld } = createTestEnv();
        const ent = new MockPhysicsEntity(gameWorld as GameWorld);
        ent.cameraLockPriority = CameraLockPriority.SuggestedLockLocal;
        gameWorld.entities?.set('foobar', ent);
        camera.update(new Ticker(), undefined);
        expect(camera.lockTarget).toBe(ent);
        expect(viewport.moveCenter).toHaveBeenCalledWith(ent.sprite.position.x, ent.sprite.position.y);
    });
    test('camera does not move if non-local lock', () => {
        const { viewport, camera, gameWorld } = createTestEnv();
        const ent = new MockPhysicsEntity(gameWorld as GameWorld);
        ent.cameraLockPriority = CameraLockPriority.SuggestedLockNonLocal;
        gameWorld.entities?.set('foobar', ent);
        camera.update(new Ticker(), undefined);
        expect(camera.lockTarget).toBe(ent);
        expect(viewport.moveCenter).not.toHaveBeenCalled();
    });
    test('camera ignores lock if user wants to move', () => {
        const { viewport, camera, gameWorld } = createTestEnv();
        const ent = new MockPhysicsEntity(gameWorld as GameWorld);
        ent.cameraLockPriority = CameraLockPriority.SuggestedLockLocal;
        gameWorld.entities?.set('foobar', ent);
        camera.update(new Ticker(), undefined);
        expect(camera.lockTarget).toBe(ent);
        expect(viewport.moveCenter).toHaveBeenCalledWith(ent.sprite.position.x, ent.sprite.position.y);
        viewport.emit('moved', { type: "test" });
        camera.update(new Ticker(), undefined);
        // Ensure not recalled.
        expect(viewport.moveCenter).toHaveBeenCalledTimes(1);
    });
    test('camera moves to a higher priority target', () => {
        const { viewport, camera, gameWorld } = createTestEnv();
        const entLower = new MockPhysicsEntity(gameWorld as GameWorld);
        const entHigher = new MockPhysicsEntity(gameWorld as GameWorld);
        entLower.cameraLockPriority = CameraLockPriority.SuggestedLockLocal;
        gameWorld.entities?.set('1', entLower);
        gameWorld.entities?.set('2', entHigher);
        camera.update(new Ticker(), undefined);
        expect(camera.lockTarget).toBe(entLower);
        expect(viewport.moveCenter).toHaveBeenCalledWith(entLower.sprite.position.x, entLower.sprite.position.y);
        entHigher.cameraLockPriority = CameraLockPriority.LockIfNotLocalPlayer;
        camera.update(new Ticker(), undefined);
        expect(camera.lockTarget).toBe(entHigher);
        expect(viewport.moveCenter).toHaveBeenCalledWith(entHigher.sprite.position.x, entHigher.sprite.position.y);
    });
    test('camera moves to a lower priority target when the higher cancels', () => {
        const { viewport, camera, gameWorld } = createTestEnv();
        const entLower = new MockPhysicsEntity(gameWorld as GameWorld);
        const entHigher = new MockPhysicsEntity(gameWorld as GameWorld);
        entLower.cameraLockPriority = CameraLockPriority.SuggestedLockLocal
        entHigher.cameraLockPriority = CameraLockPriority.LockIfNotLocalPlayer;
        gameWorld.entities?.set('1', entLower);
        gameWorld.entities?.set('2', entHigher);
        camera.update(new Ticker(), undefined);
        expect(camera.lockTarget).toBe(entHigher);
        expect(viewport.moveCenter).toHaveBeenCalledWith(entHigher.sprite.position.x, entHigher.sprite.position.y);
        entHigher.cameraLockPriority = CameraLockPriority.NoLock;
        camera.update(new Ticker(), undefined);
        expect(camera.lockTarget).toBe(entLower);
        expect(viewport.moveCenter).toHaveBeenCalledWith(entLower.sprite.position.x, entLower.sprite.position.y);
    });
});