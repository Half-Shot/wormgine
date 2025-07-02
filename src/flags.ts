import { EventEmitter } from "pixi.js";
import Input, { InputKind } from "./input";
import { ViewportCamera } from "./camera";
import type { GameWorld } from "./world";
import type { PlayableEntity } from "./entities/playable/playable";
import type { GameState } from "./logic/gamestate";

export enum DebugLevel {
  None = 0,
  BasicOverlay = 1,
  PhysicsOverlay = 2,
}

class Flags extends EventEmitter {
  public DebugView: DebugLevel;
  public simulatePhysics = true;
  public stepAnimationsId = "";
  private world?: GameWorld;
  public viewportCamera?: ViewportCamera;
  private gameState?: GameState;

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
      getWorm: this.getWorm,
      setWindSpeed: this.setWindSpeed,
      pauseGame: this.pauseGame,
      getCamera: () => this.viewportCamera,
    };
  }

  private getWorm = (nameOrId: string) => {
    if (!this.world) {
      throw Error("World not bound (are you in a game?)");
    }
    return this.world.entities.values().find((e) => {
      if ("wormIdent" in e) {
        const worm = e as PlayableEntity;
        return (
          worm.wormIdent.name === nameOrId || worm.wormIdent.uuid === nameOrId
        );
      }
      return false;
    });
  };

  private setWindSpeed = (windValue: number) => {
    if (!this.world) {
      throw Error("World not bound (are you in a game?)");
    }
    this.world.setWind(windValue);
  };

  private pauseGame = () => {
    if (!this.gameState) {
      throw Error("GameState not bound (are you in a game?)");
    }
    this.gameState.pauseTimer();
  };

  bindWorld(world?: GameWorld) {
    this.world = world;
  }
  bindGameState(gameState: GameState) {
    this.gameState = gameState;
  }
}

const globalFlags = new Flags();

export default globalFlags;
