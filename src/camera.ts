import { Viewport } from "pixi-viewport";
import { Point, Ticker } from "pixi.js";
import { GameWorld } from "./world";
import { PhysicsEntity } from "./entities/phys/physicsEntity";
import { PlayableEntity } from "./entities/playable/playable";
import { MovedEvent } from "pixi-viewport/dist/types";
import Logger from "./log";
import { MetersValue } from "./utils";

const logger = new Logger("ViewportCamera");

export enum CameraLockPriority {
  // Do not lock the camera to this object
  NoLock = 0,
  // Snap the camera to this object if the current player isn't local, but allow the user to move away.
  SuggestedLockNonLocal = 1,
  // Snap the camera to this object, but allow the user to move away.
  SuggestedLockLocal = 2,
  // Lock the camera to this object, but only suggest it to local players.
  LockIfNotLocalPlayer = 3,
  // Always lock the camera to this object.
  AlwaysLock = 4,
}

export class ViewportCamera {
  private currentLockTarget: PhysicsEntity | null = null;
  private userWantsControl = false;
  private lastMoveHash = Number.MIN_SAFE_INTEGER;

  public get lockTarget() {
    return this.currentLockTarget;
  }

  constructor(
    private readonly viewport: Viewport,
    private readonly world: GameWorld,
    private readonly clampY: MetersValue,
  ) {
    viewport.on("moved", (event: MovedEvent) => {
      if (
        event.type === "clamp-y" ||
        event.type === "clamp-x" ||
        event.type === "snap"
      ) {
        // Ignore, the director moved us.
        return;
      }
      if (this.userWantsControl === false) {
        this.userWantsControl = true;
        // Reset move hash, since the camera is under control.
        this.lastMoveHash = 0;
        logger.debug("Player took control");
      }
    });
  }

  public snapToPosition(
    newTarget: Point,
    priority: CameraLockPriority,
    currentEntityIsLocal: boolean,
  ) {
    const targetXY: [number, number] = [newTarget.x, newTarget.y];

    // Short circuit skip move if it's cheaper not to.
    const newMoveHash = newTarget.x + newTarget.y;
    if (this.lastMoveHash === newMoveHash) {
      return;
    }
    this.lastMoveHash = newMoveHash;

    const clampYTo = 200 + this.clampY.pixels - this.viewport.screenHeight / 2;

    if (targetXY[1] > clampYTo) {
      logger.info("Clamped Y", {
        from: targetXY[1],
        to: clampYTo,
        pixels: this.clampY.pixels,
        height: this.viewport.screenHeight,
      });
      targetXY[1] = clampYTo;
    }

    switch (priority) {
      case CameraLockPriority.SuggestedLockNonLocal:
        if (this.userWantsControl) {
          return;
        }
        // Need a better way to determine this.
        if (!currentEntityIsLocal) {
          this.viewport.moveCenter(...targetXY);
        }
        break;
      case CameraLockPriority.SuggestedLockLocal:
        if (this.userWantsControl) {
          return;
        }
        this.viewport.moveCenter(...targetXY);
        break;
      case CameraLockPriority.LockIfNotLocalPlayer:
        if (!currentEntityIsLocal) {
          this.viewport.moveCenter(...targetXY);
        } else if (!this.userWantsControl) {
          this.viewport.moveCenter(...targetXY);
        }
        break;

      case CameraLockPriority.AlwaysLock:
        this.viewport.moveCenter(...targetXY);
        break;
    }
  }

  public update(_dt: Ticker, currentWorm: PlayableEntity | undefined) {
    let newTarget: PhysicsEntity | null = null;
    let priority: CameraLockPriority = CameraLockPriority.NoLock;
    if (this.currentLockTarget?.destroyed) {
      this.currentLockTarget = null;
    }
    for (const e of this.world.entities.values()) {
      if (e instanceof PhysicsEntity === false) {
        continue;
      }
      if (e.cameraLockPriority > priority) {
        newTarget = e;
        priority = e.cameraLockPriority;
      }
    }
    if (!newTarget) {
      return;
    }

    const isLocal = !currentWorm?.wormIdent.team.playerUserId;
    if (newTarget !== this.currentLockTarget) {
      // Reset user control.
      this.userWantsControl = false;
      logger.debug("New lock target", newTarget.toString());
    }
    this.currentLockTarget = newTarget;
    this.snapToPosition(
      newTarget.sprite.position,
      newTarget.cameraLockPriority,
      isLocal,
    );
  }
}
