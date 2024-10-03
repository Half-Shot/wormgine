import { EventEmitter } from "pixi.js";
import Input, { InputKind } from "./input";

export enum DebugLevel {
    None = 0,
    BasicOverlay = 1,
    PhysicsOverlay = 2,
}

class Flags extends EventEmitter {
    public DebugView: DebugLevel;

    constructor() {
        super();
        const qs = new URLSearchParams(window.location.search);
        this.DebugView = !!qs.get('debug') ? DebugLevel.PhysicsOverlay : DebugLevel.None;
        Input.on('inputEnd', (type) => {
            if (type === InputKind.ToggleDebugView) {
                if (++this.DebugView > DebugLevel.PhysicsOverlay) {
                    this.DebugView = DebugLevel.None;
                }
            }
            this.emit('toggleDebugView', this.DebugView);
        })
    }
}

const globalFlags = new Flags();

export default globalFlags;