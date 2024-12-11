import { jest } from "@jest/globals";
import { EventEmitter } from "events";

export class MockViewport extends EventEmitter {
    constructor() {
        super();
    }

    public moveCenter = jest.fn();
}