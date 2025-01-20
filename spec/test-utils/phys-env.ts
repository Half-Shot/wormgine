import RAPIER, { Collider, ColliderDesc, RigidBodyDesc } from "@dimforge/rapier2d-compat";
import { Ticker } from "pixi.js";
import { GameWorld, RapierPhysicsObject } from "../../src/world";
import { IPhysicalEntity } from "../../src/entities/entity";
import { expect } from "@jest/globals";
import { resolve } from "node:path";
import { exec } from "node:child_process";
import { createCanvas } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";
import { MetersValue } from "../../src/utils";

export class PhysicsEnvironment {
    static async load() {
        await RAPIER.init();
    }

    public readonly world: GameWorld;
    public readonly player: RapierPhysicsObject;
    public readonly ticker: Ticker;
    constructor() {
        const rapierWorld = new RAPIER.World({x: 0, y: 9.81});
        this.ticker = new Ticker();
        this.world = new GameWorld(rapierWorld, this.ticker);
        this.player = this.world.createRigidBodyCollider(
            ColliderDesc.cuboid(PlayerWidth.value / 2, PlayerHeight.value / 2),
            RigidBodyDesc.dynamic().setTranslation(1, -1).lockRotations()
        );
        // Create floor
        this.world.createRigidBodyCollider(
            ColliderDesc.cuboid(3, 0.25),
            RigidBodyDesc.fixed().setTranslation(1, 2).lockRotations()
        );
        const playerEnt = {
            priority: 0,
            body: this.player.body,
            destroyed: false,
            destroy() {
                
            }, 
        } satisfies IPhysicalEntity;
        this.world.addBody(playerEnt, this.player.collider);
    }

    waitUntilStopped() {
        let step = 0;
        do {
            this.world.step();
            step++;
        } while(this.world.areEntitiesMoving() && step <= MaxSteps);
        expect(step).toBeLessThan(MaxSteps);
        return this.player.body.translation();
    }

    async after() {
        this.ticker.destroy();
        const { currentTestName, assertionCalls, numPassingAsserts } = expect.getState();
        const testName = currentTestName?.replaceAll(/\s/g, '_') ?? "unknown";
        const filename = `./test-out/${testName}.webp`;
        // Show debug shape.
        await visualisePhysics(this.world, filename, testName);
        const fullPath = resolve(filename);
        if (assertionCalls !== numPassingAsserts) {
            // No error;
            exec(`firefox ${fullPath}`)
        }
    }


    createBlock(x: number,y: number, width = 1, height = 1) {
        const body = this.world.createRigidBodyCollider(ColliderDesc.cuboid(width, height), RigidBodyDesc.fixed().setTranslation(
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
        this.world.addBody(ent, ent.collider);
        // REQUIRED: So the collider has time to be registered.
        this.world.step();
        return ent;
    }
}

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
