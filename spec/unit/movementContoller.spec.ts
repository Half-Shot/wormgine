import RAPIER, { Collider, ColliderDesc, RigidBodyDesc, Vector, Vector2 } from "@dimforge/rapier2d-compat";
import { writeFile, mkdir } from "node:fs/promises";
import { Ticker } from "pixi.js";
import { test, describe, beforeAll, expect, beforeEach, afterEach, jest } from "@jest/globals";
import { resolve } from "node:path";
import { MetersValue } from "../../src/utils";
import { IPhysicalEntity } from "../../src/entities/entity";
import { GameWorld, RapierPhysicsObject } from "../../src/world";
import { exec } from "node:child_process";
import { createCanvas } from '@napi-rs/canvas';
import { calculateMovement, debugData } from "../../src/movementController";

const PlayerWidth = new MetersValue(0.3);
const PlayerHeight = new MetersValue(0.6);
const MaxSteps = 1000;

async function visualisePhysics(world: GameWorld, fileOut: string, testName: string) {
    const canvas = createCanvas(800, 600);
    const context = canvas.getContext('2d');
    context.fillStyle = "black";
    context.fillRect(0,0,800,600);

    const buffers = world.rapierWorld.debugRender();
    const vtx = buffers.vertices;
    const cls = buffers.colors;

    for (let i = 0; i < vtx.length / 4; i += 1) {
        // Pad the canvas so we can see it.
        const vtxA = 250 + Math.round(vtx[i * 4] * 50);
        const vtxB = 250 + Math.round(vtx[i * 4 + 1] * 50);
        const vtxC = 250 + Math.round(vtx[i * 4 + 2] * 50);
        const vtxD = 250 + Math.round(vtx[i * 4 + 3] * 50);
        const color = new Float32Array([
            cls[i * 8],
            cls[i * 8 + 1],
            cls[i * 8 + 2],
            cls[i * 8 + 3],
        ]);
        context.lineWidth = 1;
        const col = `rgba(
        ${color[0]*255},
        ${color[1]*255},
        ${color[2]*255},
        ${color[3]*255})`;
        context.strokeStyle = col;
        context.moveTo(vtxA, vtxB);
        context.lineTo(vtxC, vtxD);
        context.stroke();
    }
    context.fillStyle = 'white';
    context.fillText(testName, 10, 10);
    return writeFile(fileOut, await canvas.encode("webp", 100));
}


function constructTestEnv(): { world: GameWorld, player: RapierPhysicsObject, ticker: Ticker, waitUntilStopped: () => Vector } {
    const rapierWorld = new RAPIER.World({x: 0, y: 9.81});
    const ticker = new Ticker();
    const world = new GameWorld(rapierWorld, ticker);
    const player = world.createRigidBodyCollider(
        ColliderDesc.cuboid(PlayerWidth.value / 2, PlayerHeight.value / 2),
        RigidBodyDesc.dynamic().setTranslation(1, -3).lockRotations()
    );
    // Create floor
    world.createRigidBodyCollider(
        ColliderDesc.cuboid(3, 0.25),
        RigidBodyDesc.fixed().setTranslation(1, 2).lockRotations()
    );
    const playerEnt = {
        priority: 0,
        body: player.body,
        destroyed: false,
        destroy() {
            
        }, 
    } satisfies IPhysicalEntity;
    world.addBody(playerEnt, player.collider);
    return { 
        world,
        player,
        ticker,
        waitUntilStopped: () => {
            let step = 0;
            do {
                world.step();
                step++;
            } while(world.areEntitiesMoving() && step <= MaxSteps);
            expect(step).toBeLessThan(MaxSteps);
            return player.body.translation();
        }
    }
}

function createBlock(world: GameWorld, x: number,y: number, width = 1, height = 1) {
    const body = world.createRigidBodyCollider(ColliderDesc.cuboid(width, height), RigidBodyDesc.fixed().setTranslation(
        x, y
    ));
    const ent = {
        priority: 0,
        collider: body.collider,
        body: body.body,
        destroyed: false,
        destroy() {
            
        }, 
    } satisfies IPhysicalEntity&{collider: Collider};
    world.addBody(ent, ent.collider);
    // REQUIRED: So the collider has time to be registered.
    world.step();
    return ent;
}

const maxStep = new MetersValue(0.2);

describe('calculateMovement', () => {
    beforeAll(async () => {
        await RAPIER.init();
        await mkdir("./test-out", { recursive: true });
    });

    let env: ReturnType<typeof constructTestEnv>;
    beforeEach(async () => {
        env = constructTestEnv();
    });

    afterEach(async () => {
        env.ticker.destroy();
        const { currentTestName, assertionCalls, numPassingAsserts } = expect.getState();
        const testName = currentTestName?.replaceAll(/\s/g, '_') ?? "unknown";
        const filename = `./test-out/${testName}.webp`;
        // Show debug shape.
        if (debugData) {
            env.world.createRigidBodyCollider(new ColliderDesc(debugData.shape), RigidBodyDesc.fixed().setTranslation(debugData.rayCoodinate.worldX, debugData.rayCoodinate.worldY));
        }
        await visualisePhysics(env.world, filename, testName);
        const fullPath = resolve(filename);
        if (assertionCalls !== numPassingAsserts) {
            // No error;
            exec(`firefox ${fullPath}`)
        }
    })

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
        createBlock(env.world, 0, 1.25, 0.5, 0.5);
        const originalTranslation = env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(originalTranslation.x-x).toBeCloseTo(0, 1);
        expect(originalTranslation.y-y).toBeCloseTo(0, 1);
    });

    test('should be able to step on top of obstacles', () => {
        createBlock(env.world, 0.5, 1.5, 0.25, 0.25);
        env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(x).toBeCloseTo(0.5, 1);
        expect(y).toBeCloseTo(1, 1);
    });

    test('should be able to step up stairs', () => {
        createBlock(env.world, 0.5, 1.5, 0.25, 0.25);
        createBlock(env.world, 0, 1, 0.25, 0.25);
        createBlock(env.world, -0.5, 0.5, 0.25, 0.25);
        env.waitUntilStopped();
        env.player.body.setTranslation(calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world), false);
        env.waitUntilStopped();
        env.player.body.setTranslation(calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world), false);
        env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(x).toBeCloseTo(-0.5, 1);
        expect(y).toBeCloseTo(0, 0.5);
    });

    test('should be able to step down stairs', () => {
        createBlock(env.world, 1,    0,    0.25, 0.25);
        createBlock(env.world, 0.5,  0.25, 0.25, 0.25);
        createBlock(env.world, 0,    0.5,  0.25, 0.25);
        createBlock(env.world, -0.5, 0.75, 0.25, 0.25);
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

    test('should not be able to enter small cave-like entrances', () => {
        createBlock(env.world, 0.5, 1.5, 0.25, 0.25);
        createBlock(env.world, 0.5, 0.5, 0.25, 0.25);
        const { y: originalY } = env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(x).toBeCloseTo(1, 0.5);
        expect(y).toBeCloseTo(originalY, 0.5);
    });

    test('should be able to enter large cave-like entrances', () => {
        createBlock(env.world, 0.5, 1.5, 0.25, 0.25);
        createBlock(env.world, 0.5, 0.25, 0.25, 0.25);
        env.waitUntilStopped();
        const move = calculateMovement(env.player, new Vector2(-0.5, 0), maxStep, env.world);
        env.player.body.setTranslation(move, false);
        const {x, y} = env.waitUntilStopped();
        expect(x).toBeCloseTo(0.5, 0.5);
        expect(y).toBeCloseTo(1, 0.5);
    });
});