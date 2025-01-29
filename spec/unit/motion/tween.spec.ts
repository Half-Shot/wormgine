import { test, describe, expect, beforeEach, afterEach, beforeAll } from "@jest/globals";
import { add, Coordinate, MetersValue } from "../../../src/utils";
import { PhysicsEnvironment as PhysicsTestEnvironment } from "../../test-utils/phys-env";
import { TweenEngine } from "../../../src/motion/tween";


const maxStep = new MetersValue(0.2);

describe('TweenEngine', () => {
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

    test('can tween a motion', () => {
        env.waitUntilStopped();
        const {x, y} = env.player.body.translation();
        const from = Coordinate.fromWorld(env.player.body.translation());
        const to = Coordinate.fromWorld(add(env.player.body.translation(), { x: 2, y: 0 }));
        const engine = new TweenEngine(env.player.body, { x: 0.1, y: 0 }, to);
        const moved = engine.update(50);
        env.waitUntilStopped();
    });
});