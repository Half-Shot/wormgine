import { EventEmitter } from "pixi.js";
import Input, { InputKind } from "./input";

class Flags extends EventEmitter {
    public DebugView = false;

    constructor() {
        super();
        const qs = new URLSearchParams(window.location.search);
        this.DebugView = !!qs.get('debug');
        Input.on('inputEnd', (type) => {
            if (type === InputKind.ToggleDebugView) {
                this.DebugView = !this.DebugView;
            }
            this.emit('toggleDebugView', this.DebugView);
        })
    }
}

const globalFlags = new Flags();

export default globalFlags;