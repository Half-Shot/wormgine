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
  WeaponMenu,
}

const MouseButtonNames = ["MouseLeft", "MouseRight", "MouseWheel"];

const DefaultBinding: Record<string, InputKind> = Object.freeze({
  ArrowLeft: InputKind.MoveLeft,
  ArrowRight: InputKind.MoveRight,
  ArrowUp: InputKind.AimUp,
  ArrowDown: InputKind.AimDown,
  Enter: InputKind.Jump,
  "Backspace,Backspace": InputKind.Backflip,
  MouseRight: InputKind.WeaponMenu,
  // I LOVE THE CONSISTENCY HERE BROWSERS
  " ": InputKind.Fire,
  F9: InputKind.ToggleDebugView,
  s: InputKind.DebugSwitchWeapon,
  "1": InputKind.WeaponTimer1,
  "2": InputKind.WeaponTimer2,
  "3": InputKind.WeaponTimer3,
  "4": InputKind.WeaponTimer4,
  "5": InputKind.WeaponTimer5,
});

const sequenceTimeoutMs = 250;

type Sequence = { sequence: string[]; inputKind: InputKind };

class Controller extends EventEmitter {
  private readonly activeInputs = new Set();
  private activeSequences = new Array<Sequence>();
  private readonly sequences = new Array<Sequence>();
  private activeTimeout: NodeJS.Timeout | undefined;

  constructor(
    private readonly bindings: Record<string, InputKind> = DefaultBinding,
  ) {
    super();
    for (const [keyBind, inputKind] of Object.entries(bindings)) {
      const parts = keyBind.split(",");
      if (parts.length === 1) {
        continue;
      }
      this.sequences.push({ sequence: parts, inputKind });
    }
    // TODO: Only bind when the game has started.
    window.addEventListener("keydown", this.onKeyDown.bind(this));
    window.addEventListener("keyup", this.onKeyUp.bind(this));
  }

  public bindMouseInput() {
    const overlayElement = document.querySelector<HTMLDivElement>("#overlay");
    if (!overlayElement) {
      throw Error("Missing overlay element");
    }
    overlayElement.addEventListener("mousedown", this.onMouseDown.bind(this));
    overlayElement.addEventListener("mouseup", this.onMouseUp.bind(this));
    overlayElement.addEventListener("contextmenu", (event) =>
      event.preventDefault(),
    );
  }

  public isInputActive(kind: InputKind) {
    return this.activeInputs.has(kind);
  }

  private onKeyDown(ev: KeyboardEvent) {
    const inputKind = this.bindings[ev.key];

    // TODO: Optimise.
    if (this.activeSequences.length > 0) {
      this.activeSequences = this.activeSequences
        .filter((s) => s.sequence[0] === ev.key)
        .map((s) => {
          s.sequence.splice(0, 1);
          return s;
        });
      const sequencesToFire = this.activeSequences.filter(
        (s) => s.sequence.length === 0,
      );
      if (sequencesToFire.length) {
        for (const element of this.activeSequences.filter(
          (s) => s.sequence.length === 0,
        )) {
          this.emit("inputBegin", element.inputKind);
          // TODO: Wait for actual input end?
          this.emit("inputEnd", element.inputKind);
        }
        this.activeSequences = [];
        clearTimeout(this.activeTimeout);
      }
    } else {
      this.activeSequences.push(
        ...this.sequences
          .filter((s) => s.sequence[0] === ev.key)
          .map((s) => {
            return {
              sequence: s.sequence.slice(1),
              inputKind: s.inputKind,
            };
          }),
      );
    }

    clearTimeout(this.activeTimeout);
    this.activeTimeout = setTimeout(() => {
      this.activeSequences = [];
      this.activeTimeout = undefined;
    }, sequenceTimeoutMs);

    if (inputKind === undefined || this.activeInputs.has(inputKind)) {
      return;
    }
    this.activeInputs.add(inputKind);
    this.emit("inputBegin", inputKind);
  }

  private onKeyUp(ev: KeyboardEvent) {
    const inputKind = DefaultBinding[ev.key];
    if (inputKind === undefined || !this.activeInputs.has(inputKind)) {
      return;
    }
    this.activeInputs.delete(inputKind);
    this.emit("inputEnd", inputKind);
  }

  private onMouseDown(ev: MouseEvent) {
    const buttonNames = MouseButtonNames.filter((_name, i) =>
      Boolean(ev.buttons & (1 << i)),
    );

    const inputKinds = buttonNames.map((v) => DefaultBinding[v]);
    for (const inputKind of inputKinds) {
      if (this.activeInputs.has(inputKind)) {
        continue;
      }
      this.activeInputs.add(inputKind);
      this.emit("inputBegin", inputKind);
    }
  }
  private onMouseUp(ev: MouseEvent) {
    const buttonName = MouseButtonNames.find((_name, i) =>
      Boolean(ev.button & (1 << i)),
    );

    if (buttonName) {
      const inputKind = DefaultBinding[buttonName];
      if (!this.activeInputs.has(inputKind)) {
        return;
      }
      this.activeInputs.delete(inputKind);
      this.emit("inputEnd", inputKind);
    }
  }
}

const staticController = new Controller();

export default staticController;
