import Logger from "./log";
import { PointData } from "pixi.js";
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
  PickTarget,
}

const MouseButtonNames = ["MouseLeft", "MouseRight", "MouseWheel"];

const DefaultBinding: Record<string, InputKind> = Object.freeze({
  ArrowLeft: InputKind.MoveLeft,
  ArrowRight: InputKind.MoveRight,
  ArrowUp: InputKind.AimUp,
  ArrowDown: InputKind.AimDown,
  Enter: InputKind.Jump,
  "Backspace,Backspace": InputKind.Backflip,
  MouseLeft: InputKind.PickTarget,
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

const logger = new Logger("Controller");
interface GameReactChannelEvents {
  inputBegin: (kind: InputKind, position?: PointData) => void;
  inputEnd: (kind: InputKind, position?: PointData) => void;
}

class Controller extends EventEmitter<GameReactChannelEvents> {
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
  }

  public bindInput() {
    window.addEventListener("keydown", this.onKeyDown.bind(this));
    window.addEventListener("keyup", this.onKeyUp.bind(this));
    const overlayElement = document.querySelector<HTMLDivElement>("#overlay");
    if (!overlayElement) {
      throw Error("Missing overlay element");
    }
    overlayElement.addEventListener("mousedown", (ev) => {
      if ((ev.target as HTMLElement).tagName === "button") {
        // Ignore.
        return;
      }
      this.onMouseDown(ev);
    });
    overlayElement.addEventListener("mouseup", (ev) => {
      if ((ev.target as HTMLElement).tagName === "button") {
        // Ignore.
        return;
      }
      this.onMouseUp(ev);
    });
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
    logger.debug(`onMouseDown`, buttonNames, inputKinds, ev);
    for (const inputKind of inputKinds) {
      if (this.activeInputs.has(inputKind)) {
        continue;
      }
      logger.debug(`onMouseDown.inputBegin`, inputKind);
      this.activeInputs.add(inputKind);
      this.emit("inputBegin", inputKind, { x: ev.clientX, y: ev.clientY });
    }
  }
  private onMouseUp(ev: MouseEvent) {
    let buttonName = MouseButtonNames.find((_name, i) =>
      Boolean(ev.button & (1 << i)),
    );

    // Observed this on FireFox.
    if (ev.button === 0) {
      buttonName = "MouseLeft";
    }

    logger.debug(`onMouseUp`, buttonName, ev);
    if (buttonName) {
      const inputKind = DefaultBinding[buttonName];
      logger.debug(`onMouseUp `, inputKind);
      if (!this.activeInputs.has(inputKind)) {
        return;
      }
      logger.debug(`onMouseUp.inputEnd`, inputKind);
      this.activeInputs.delete(inputKind);
      this.emit("inputEnd", inputKind, { x: ev.clientX, y: ev.clientY });
    }
  }
}

const staticController = new Controller();

export default staticController;
