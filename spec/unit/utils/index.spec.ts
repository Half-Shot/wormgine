import { test, describe, expect } from "@jest/globals";
import { angleForVector } from "../../../src/utils";
describe('utils', () => {
    describe('angleForVector', () => {
        test('test positive x, positive y', () => {
            expect(angleForVector({x: 3, y: 3})).toBeCloseTo(0.785);
        });
        test('test negative x, negative y', () => {
            expect(angleForVector({x: -3, y: -3})).toBeCloseTo(-2.356);
        });
        test('test positive x, negative y', () => {
            expect(angleForVector({x: 3, y: -3})).toBeCloseTo(-0.785);
        });
        test('test negative x, positive y', () => {
            expect(angleForVector({x: -3, y: 3})).toBeCloseTo(0);
        });
    })
});