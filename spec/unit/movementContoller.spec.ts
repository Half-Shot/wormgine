import { test, describe, beforeAll, expect } from "@jest/globals";
import { GameWorld, RapierPhysicsObject } from "../../src/world";
import RAPIER, { ColliderDesc, RigidBodyDesc, Vector2 } from "@dimforge/rapier2d-compat";
import { Ticker } from "pixi.js";
import { MetersValue } from "../../src/utils";
import { calculateMovement } from "../../src/movementController";

const PlayerWidth = new MetersValue(0.3);
const PlayerHeight = new MetersValue(0.6);


function constructTestEnv(): { world: GameWorld, player: RapierPhysicsObject, ticker: Ticker } {
    const rapierWorld = new RAPIER.World({x: 0, y: 9.81});
    const ticker = new Ticker();
    const world = new GameWorld(rapierWorld, ticker);
    const player = world.createRigidBodyCollider(
        ColliderDesc.cuboid(PlayerWidth.value / 2, PlayerHeight.value / 2),
        RigidBodyDesc.dynamic().setTranslation(50, 50).lockRotations()
    );
    // Create floor
    world.createRigidBodyCollider(
        ColliderDesc.cuboid(100, 10),
        RigidBodyDesc.fixed().setTranslation(0, 70).lockRotations()
    );
    return { 
        world,
        player,
        ticker,
    }
}

describe('calculateMovement', () => {
    beforeAll(async () => {
        await RAPIER.init();
    })

    test('test environment is sane', () => {
        const env = constructTestEnv();
        do {
            env.world.step();
        } while(env.player.body.isMoving())
        const {x, y} = env.player.body.translation();
        expect(x).toBeCloseTo(50);
        expect(y).toBeCloseTo(60, 0);
    });

    test('should be able to move left when there are no obstacles', () => {
        const env = constructTestEnv();
        const move = calculateMovement(env.player, new Vector2(-5, 0), env.world);
        env.player.body.setTranslation(move, false);
        do {
            env.world.step();
        } while(env.player.body.isMoving())
        const {x, y} = env.player.collider.translation();
        expect(x).toBeCloseTo(45);
        expect(y).toBeCloseTo(60, 0);
    });

    test('should be able to move right when there are no obstacles', () => {
        const env = constructTestEnv();
        const move = calculateMovement(env.player, new Vector2(5, 0), env.world);
        env.player.body.setTranslation(move, false);
        do {
            env.world.step();
        } while(env.player.body.isMoving())
        const {x, y} = env.player.collider.translation();
        expect(x).toBeCloseTo(55);
        expect(y).toBeCloseTo(60, 0);
    });
});