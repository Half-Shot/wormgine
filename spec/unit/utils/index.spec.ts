import { test, describe, expect } from "@jest/globals";
import { pointOnRadius } from "../../../src/utils";
describe('utils', () => {
    describe('pointOnRadius', () => {
        test('should give a point on a radius', () => {
            const { x,y } = pointOnRadius(0, 0, 2, 100);
            expect(x).toBeCloseTo(-41.61, 1);
            expect(y).toBeCloseTo(90.92, 1);
        });
    })
});