import { test, describe, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import { MetersValue } from "../../src/utils";
import { calculateMovement } from "../../src/movementController";
import { PhysicsEnvironment as PhysicsTestEnvironment } from "../test-utils/phys-env";
import { Vector2 } from "@dimforge/rapier2d-compat";


const maxStep = new MetersValue(0.2);

describe('calculateMovement', () => {
    let env: PhysicsTestEnvironment;

    beforeAll(() => {
        return PhysicsTestEnvironment.load();
    })

    beforeEach(async () => {
        env = new PhysicsTestEnvironment();
    });

    afterEach(() => {
        return env.after();
    });

    test('test environment is sane', () => {
        env.waitUntilStopped();
        const {x, y} = env.player.body.translation();
        expect(x).toBeCloseTo(1);
        expect(y).toBeCloseTo(1.5, 0);
    });

    test('should be able to move left when there are no obstacles', () => {
        env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-1, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(x).toBeCloseTo(0);
        expect(y).toBeCloseTo(1.5, 0);
    });

    test('should be able to move right when there are no obstacles', () => {
        env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(1, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} =env.waitUntilStopped();
        expect(x).toBeCloseTo(2);
        expect(y).toBeCloseTo(1.5, 0);
    });

    test('should not be able to move if an obstacle is in the way', () => {
        env.createBlock(0, 1.25, 0.5, 0.5);
        const originalTranslation = env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(originalTranslation.x-x).toBeCloseTo(0, 1);
        expect(originalTranslation.y-y).toBeCloseTo(0, 1);
    });

    test('should be able to step on top of obstacles', () => {
        env.createBlock(0.5, 1.5, 0.25, 0.25);
        env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(x).toBeCloseTo(0.5, 1);
        expect(y).toBeCloseTo(1, 1);
    });

    // TODO: Check this behaviour, test rewrite?
    test.failing('should be able to step up stairs', () => {
        env.createBlock(0.5, 1.5, 0.25, 0.25);
        env.createBlock(0, 1, 0.25, 0.25);
        env.createBlock(-0.5, 0.5, 0.25, 0.25);
        env.waitUntilStopped();
        env.player.body.setTranslation(calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world), false);
        env.waitUntilStopped();
        env.player.body.setTranslation(calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world), false);
        env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(x).toBeCloseTo(-0.5, 1.5);
        expect(y).toBeCloseTo(0, 0.5);
    });

    test('should be able to step down stairs', () => {
        env.createBlock(1,    0,    0.25, 0.25);
        env.createBlock(0.5,  0.25, 0.25, 0.25);
        env.createBlock(0,    0.5,  0.25, 0.25);
        env.createBlock(-0.5, 0.75, 0.25, 0.25);
        env.waitUntilStopped();
        env.player.body.setTranslation(calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world), false);
        env.waitUntilStopped();
        env.player.body.setTranslation(calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world), false);
        env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(x).toBeCloseTo(-0.5, 1);
        expect(y).toBeCloseTo(0.25, 0.5);
    });

    // TODO: Check this behaviour, test rewrite?
    test.failing('should not be able to enter small cave-like entrances', () => {
        env.createBlock(0.5, 1.5, 0.25, 0.25);
        env.createBlock(0.5, 0.5, 0.25, 0.25);
        const { y: originalY } = env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(x).toBeCloseTo(1, 0.5);
        expect(y).toBeCloseTo(originalY, 0.5);
    });

    test('should be able to enter large cave-like entrances', () => {
        env.createBlock(0.5, 1.5, 0.25, 0.25);
        env.createBlock(0.5, 0.25, 0.25, 0.25);
        env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(x).toBeCloseTo(0.5, 0.5);
        expect(y).toBeCloseTo(1, 0.5);
    });

    // TODO: Check this behaviour, test rewrite?
    test.failing('should fall back to lower blocks if there is clearance', () => {
        env.createBlock(0.15, 1.25, 0.15, 0.15);
        env.createBlock(0.5, 1.55, 0.15, 0.15);
        env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(x).toBeCloseTo(0.5, 0.5);
        expect(y).toBeCloseTo(1, 0.5);
    });
});