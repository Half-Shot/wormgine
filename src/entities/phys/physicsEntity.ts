import {
  UPDATE_PRIORITY,
  Sprite,
  Point,
  TilingSprite,
  View,
  ViewContainer,
} from "pixi.js";
import { IPhysicalEntity, OnDamageOpts } from "../entity";
import { Water } from "../water";
import { BodyWireframe } from "../../mixins/bodyWireframe";
import globalFlags, { DebugLevel } from "../../flags";
import { IMediaInstance, Sound } from "@pixi/sound";
import { GameWorld, PIXELS_PER_METER, RapierPhysicsObject } from "../../world";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { magnitude, MetersValue, mult, sub } from "../../utils";
import { AssetPack } from "../../assets";
import type { RecordedEntityState } from "../../state/model";
import { CameraLockPriority } from "../../camera";
import { BehaviorSubject, distinct, Observable, of } from "rxjs";
import Logger from "../../log";

const log = new Logger("PhysicsEntity");

/**
 * Abstract class for any physical object in the world. The
 * object must have at most one body and one sprite.
 *
 * Collision on water and force from explosions are automatically
 * calculated.
 */
export abstract class PhysicsEntity<
  T extends RecordedEntityState = RecordedEntityState,
  S extends ViewContainer = Sprite,
> implements IPhysicalEntity
{
  public static readAssets({ sounds }: AssetPack) {
    PhysicsEntity.splashSound = sounds.splash;
  }

  protected isSinking = false;
  protected isDestroyed = false;
  protected sinkingY = 0;
  protected wireframe: BodyWireframe;

  protected renderOffset?: Point;
  protected rotationOffset = 0;

  private static splashSound: Sound;

  priority = UPDATE_PRIORITY.NORMAL;
  private splashSoundPlayback?: IMediaInstance;

  protected desiredCameraLockPriority = new BehaviorSubject<CameraLockPriority>(
    CameraLockPriority.NoLock,
  );

  public get destroyed() {
    return this.isDestroyed;
  }

  public get body() {
    return this.physObject.body;
  }

  private readonly bodyMoving: BehaviorSubject<boolean>;
  public readonly bodyMoving$: Observable<boolean>;

  public get cameraLockPriority$() {
    return this.desiredCameraLockPriority.asObservable();
  }

  constructor(
    public readonly sprite: S,
    protected physObject: RapierPhysicsObject,
    protected gameWorld: GameWorld,
  ) {
    this.wireframe = new BodyWireframe(
      this.physObject,
      globalFlags.DebugView >= DebugLevel.BasicOverlay,
    );
    globalFlags.on("toggleDebugView", (level: DebugLevel) => {
      this.wireframe.enabled = level >= DebugLevel.BasicOverlay;
    });
    this.bodyMoving = new BehaviorSubject(false);
    this.bodyMoving$ = this.bodyMoving.pipe(distinct());
    this.cameraLockPriority$.subscribe((s) => {
      log.info("Camera lock changed for", this.toString(), s);
    });
  }

  destroy(): void {
    this.desiredCameraLockPriority.next(CameraLockPriority.NoLock);
    this.isDestroyed = true;
    this.sprite.destroy();
    this.wireframe.renderable.destroy();
    this.gameWorld.removeBody(this.physObject);
    this.gameWorld.removeEntity(this);
  }

  update(dt: number, _dMs: number): void {
    this.bodyMoving.next(this.body.isMoving());
    const pos = this.physObject.body.translation();
    const rotation = this.physObject.body.rotation() + this.rotationOffset;
    this.sprite.updateTransform({
      x: pos.x * PIXELS_PER_METER + (this.renderOffset?.x ?? 0),
      y: pos.y * PIXELS_PER_METER + (this.renderOffset?.y ?? 0),
      rotation,
    });

    this.wireframe.update();

    // TODO: We do need a better system for this.
    if (this.body.translation().y > 1080 / PIXELS_PER_METER) {
      this.isSinking = true;
    }

    // Sinking.
    if (this.isSinking) {
      this.physObject.body.setTranslation(
        { x: pos.x, y: pos.y + 0.05 * dt },
        false,
      );
      if (pos.y > this.sinkingY) {
        this.destroy();
      }
    }
  }

  onCollision(otherEnt: IPhysicalEntity, contactPoint: Vector2) {
    if (otherEnt instanceof Water) {
      this.desiredCameraLockPriority.next(CameraLockPriority.NoLock);

      if (
        !this.splashSoundPlayback?.progress ||
        this.splashSoundPlayback.progress === 1
      ) {
        // TODO: Hacks
        Promise.resolve(PhysicsEntity.splashSound.play()).then((instance) => {
          this.splashSoundPlayback = instance;
        });
      }
      const contactY = contactPoint.y;
      // Time to sink
      this.isSinking = true;
      this.sinkingY = contactY + 10;
      // Set static.
      this.physObject.body.setEnabled(false);
      return true;
    }
    return false;
  }

  onDamage(point: Vector2, radius: MetersValue, _opts: OnDamageOpts): void {
    const bodyTranslation = this.physObject.body.translation();
    const forceMag =
      radius.value / magnitude(sub(point, this.physObject.body.translation()));
    const force = mult(
      sub(point, bodyTranslation),
      new Vector2(-forceMag, -forceMag * 1.5),
    );
    this.physObject.body.applyImpulse(force, true);
  }

  applyState(state: T): void {
    log.debug("Applying state", state);
    this.body.setTranslation(state.tra, true);
    // this.body.setLinvel(state.vel, true);
    // this.body.setRotation(state.rot, true);
  }

  recordState(): T {
    const translation = this.body.translation();
    const rotation = this.body.rotation();
    const linvel = this.body.linvel();
    return {
      type: -1,
      tra: {
        x: translation.x,
        y: translation.y,
      },
      rot: rotation,
      vel: {
        x: linvel.x,
        y: linvel.y,
      },
    } as T;
  }
}
