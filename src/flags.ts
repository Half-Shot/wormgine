import { EventEmitter } from "pixi.js";
import Input, { InputKind } from "./input";
import { WormInstance } from "./logic";
import { ViewportCamera } from "./camera";

export enum DebugLevel {
  None = 0,
  BasicOverlay = 1,
  PhysicsOverlay = 2,
}

class Flags extends EventEmitter {
  public DebugView: DebugLevel;
  public simulatePhysics = true;
  public stepAnimationsId = "";
  public wormInstances?: WormInstance[];
  public viewportCamera?: ViewportCamera;

  constructor() {
    super();
    // Don't assume that window exists (e.g. searching)
    const qs = new URLSearchParams(globalThis.location?.hash?.slice?.(1) ?? "");
    this.DebugView = qs.get("debug")
      ? DebugLevel.PhysicsOverlay
      : DebugLevel.None;
    Input.on("inputEnd", (type) => {
      if (type === InputKind.ToggleDebugView) {
        if (++this.DebugView > DebugLevel.PhysicsOverlay) {
          this.DebugView = DebugLevel.None;
        }
      }
      this.emit("toggleDebugView", this.DebugView);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)["wormgineFlags"] = {
      toggleSimulatePhysics: () =>
        (this.simulatePhysics = !this.simulatePhysics),
      stepAnimation: (step = true) =>
        (this.stepAnimationsId = step ? Math.random().toString() : ""),
      getWorm: (nameOrId: string) =>
        this.wormInstances?.find(
          (w) => w.name === nameOrId || w.uuid === nameOrId,
        ),
      getCamera: () => this.viewportCamera,
    };
  }
}

const globalFlags = new Flags();

export default globalFlags;
