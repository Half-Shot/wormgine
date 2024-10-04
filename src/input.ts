import { EventEmitter } from "pixi.js";

export enum InputKind {
    MoveLeft,
    MoveRight,
    AimUp,
    AimDown,
    Fire,
    ToggleDebugView,
    DebugSwitchWeapon,
    WeaponTimer1,
    WeaponTimer2,
    WeaponTimer3,
    WeaponTimer4,
    WeaponTimer5,
}

const DefaultBinding: Record<string, InputKind> = Object.freeze({
    "ArrowLeft": InputKind.MoveLeft,
    "ArrowRight": InputKind.MoveRight,
    "ArrowUp": InputKind.AimUp,
    "ArrowDown": InputKind.AimDown,
    // I LOVE THE CONSISTENCY HERE BROWSERS
    " ": InputKind.Fire,
    "F9": InputKind.ToggleDebugView,
    "s": InputKind.DebugSwitchWeapon,
    "1": InputKind.WeaponTimer1,
    "2": InputKind.WeaponTimer2,
    "3": InputKind.WeaponTimer3,
    "4": InputKind.WeaponTimer4,
    "5": InputKind.WeaponTimer5,
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