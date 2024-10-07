import { EventEmitter } from "pixi.js";

export enum InputKind {
    MoveLeft,
    MoveRight,
    AimUp,
    AimDown,
    Jump,
    Backflip,
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
    "Enter": InputKind.Jump,
    "Backspace,Backspace": InputKind.Backflip,
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

const sequenceTimeoutMs = 250;

type Sequence = {sequence: string[], inputKind: InputKind};

class Controller extends EventEmitter {

    private readonly activeInputs = new Set();
    private activeSequences = new Array<Sequence>();
    private readonly sequences = new Array<Sequence>();
    private activeTimeout: NodeJS.Timeout|undefined;

    constructor(private readonly bindings: Record<string, InputKind> = DefaultBinding) {
        super();
        for (const [keyBind, inputKind] of Object.entries(bindings)) {
            const parts = keyBind.split(',');
            if (parts.length === 1) {
                continue;
            }
            this.sequences.push({sequence: parts, inputKind});
        }
        console.log(this.sequences);
        window.addEventListener('keydown', this.onKeyDown.bind(this));
        window.addEventListener('keyup', this.onKeyUp.bind(this));
    }

    public isInputActive(kind: InputKind) {
        return this.activeInputs.has(kind);
    }

    private onKeyDown(ev: KeyboardEvent) {
        const inputKind = this.bindings[ev.key];


        // TODO: Optimise.
        if (this.activeSequences.length > 0) {
            console.log('checking active seq');
            this.activeSequences = this.activeSequences.filter(s => s.sequence[0] === ev.key).map(s => {
                s.sequence.splice(0,1);
                return s;
            });
            const sequencesToFire = this.activeSequences.filter(s => s.sequence.length === 0);
            if (sequencesToFire.length) {
                console.log("Firing AS", sequencesToFire);
                for (const element of this.activeSequences.filter(s => s.sequence.length === 0)) {
                    this.emit('inputBegin', element.inputKind);
                    // TODO: Wait for actual input end?
                    this.emit('inputEnd', element.inputKind);
                }
                this.activeSequences = [];
                clearTimeout(this.activeTimeout);
            }
        } else {
            this.activeSequences.push(...this.sequences.filter(s => s.sequence[0] === ev.key).map(s => {
                return {
                    sequence: s.sequence.slice(1),
                    inputKind: s.inputKind,
                };
            }));
            console.log('adding new seq');
        }
        console.log("AS", this.activeSequences);

        clearTimeout(this.activeTimeout);
        this.activeTimeout = setTimeout(() => {
            this.activeSequences = [];
            this.activeTimeout = undefined;
        }, sequenceTimeoutMs);

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