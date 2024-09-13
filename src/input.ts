import { EventEmitter } from "pixi.js";

export enum InputKind {
    MoveLeft,
    MoveRight,
    Fire,
    ToggleDebugView,
}

const DefaultBinding: Record<string, InputKind> = Object.freeze({
    "ArrowLeft": InputKind.MoveLeft,
    "ArrowRight": InputKind.MoveRight,
    "Space": InputKind.Fire,
    "F9": InputKind.ToggleDebugView,
});

class Controller extends EventEmitter {

    private readonly activeInputs = new Set();

    constructor() {
        super();
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
    }

    public isInputActive(kind: InputKind) {
        return this.activeInputs.has(kind);
    }

    private onKeyDown(ev: KeyboardEvent) {
        const inputKind = DefaultBinding[ev.key];
        if (inputKind === undefined || this.activeInputs.has(inputKind)) {
            return;
        }
        this.activeInputs.add(inputKind);
        this.emit('inputBegin', inputKind);
    }

    private onKeyUp(ev: KeyboardEvent) {
        const inputKind = DefaultBinding[ev.key];
        if (inputKind === undefined || !this.activeInputs.has(inputKind)) {
            return;
        }
        this.activeInputs.delete(inputKind);
        this.emit('inputEnd', inputKind);
    }
}

const staticController = new Controller();

export default staticController;