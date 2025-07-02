import { Viewport } from "pixi-viewport";
import { Point } from "pixi.js";
import { MovedEvent } from "pixi-viewport/dist/types";
import Logger from "./log";
import { MetersValue } from "./utils";
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  map,
  merge,
  Observable,
  Subscription,
} from "rxjs";

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

export interface LockableEntity {
  cameraLockPriority$: Observable<CameraLockPriority>;
  destroyed: boolean;
  sprite: {
    position: Point;
  };
}

type CurrentLockType = {
  target: LockableEntity;
  priority: CameraLockPriority;
  isLocal: boolean;
} | null;

export class ViewportCamera {
  private currentLock = new BehaviorSubject<CurrentLockType>(null);
  private userWantsControl = false;
  private lastMoveHash = Number.MIN_SAFE_INTEGER;
  private cameraSub?: Subscription;

  /**
   * Gets an observable to the current lock target.
   */
  public get lockTarget(): Observable<CurrentLockType> {
    return merge(this.currentLock.asObservable());
  }

  constructor(
    private readonly viewport: Viewport,
    private readonly clampY: MetersValue,
    physicalEntities: Observable<IteratorObject<LockableEntity>>,
    currentPlayableIsLocal: Observable<boolean>,
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
    combineLatest([physicalEntities, currentPlayableIsLocal])
      .pipe(debounceTime(200))
      .subscribe(([entities, currentPlayableIsLocal]) => {
        this.updateEntitySet(entities, currentPlayableIsLocal);
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

    const clampYTo = this.clampY.pixels - this.viewport.screenHeight / 2;

    if (targetXY[1] > clampYTo) {
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

  public updateEntitySet(
    entities: IteratorObject<LockableEntity>,
    isLocal: boolean,
  ) {
    this.cameraSub?.unsubscribe();
    logger.info("Recalculating entity set");

    const obs = entities
      // XXX: This type is actually wrong.
      .filter((entity) => entity.cameraLockPriority$)
      .map((entity) =>
        entity.cameraLockPriority$.pipe(
          map((priority) => ({ priority, entity })),
        ),
      );

    this.cameraSub = combineLatest([...obs]).subscribe((entities) => {
      logger.info(
        "New camera lock requested",
        entities.map((e) => ({
          priority: e.priority,
          ent: e.entity.toString(),
        })),
      );
      const currentTarget = this.currentLock.value;
      let nextTarget = currentTarget;

      // Apply new value for currentLock before iterating.
      const currentEnt = entities.find(
        (e) => e.entity === currentTarget?.target,
      );
      if (this.currentLock && !currentEnt) {
        // Ent is no longer found.
        nextTarget = null;
      } else if (nextTarget && currentEnt) {
        nextTarget.priority = currentEnt.priority;
      }

      for (const { entity, priority } of entities) {
        if (priority === CameraLockPriority.NoLock) {
          continue;
        }
        if (currentTarget && currentTarget?.priority >= priority) {
          logger.debug(
            "New lock is not higher priority than",
            currentTarget.target.toString(),
            CameraLockPriority[priority],
          );
          // Skipping as higher priority exists.
          continue;
        }
        if (entity !== currentTarget?.target) {
          // Reset user control.
          this.userWantsControl = false;
          logger.debug("New lock target", entity.toString());
          nextTarget = {
            target: entity,
            priority,
            isLocal,
          };
        } else {
          logger.debug("New lock target is same as last, ignoring");
          continue;
        }
      }
      this.currentLock.next(nextTarget);
    });
  }

  public update() {
    const currentTarget = this.currentLock.getValue();
    if (currentTarget && !currentTarget.target.destroyed) {
      this.snapToPosition(
        currentTarget.target.sprite.position,
        currentTarget.priority,
        currentTarget.isLocal,
      );
    }
  }
}
