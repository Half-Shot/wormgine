import { describe, expect, test } from "@jest/globals";
import { fromNetObject, toNetObject } from "../../../src/net/netfloat";


describe('Netfloat', () => {
    test('test parsing into network format with empty object', () => {
        expect(
            fromNetObject(toNetObject({}))
        ).toEqual({});
    });
    test('test parsing into network format with simple object', () => {
        expect(
            fromNetObject(toNetObject({a: 1.2345}))
        ).toEqual({
            a: 1.2345
        });
    });
    test('test parsing nested objects', () => {
        expect(
            fromNetObject(toNetObject({
                a: {
                    b: 1.2345
                }
            }))
        ).toEqual({
            a: {
                b: 1.2345
            }
        });
    });
});