import { UPDATE_PRIORITY, Sprite, Point, ViewContainer } from "pixi.js";
import { IPhysicalEntity, OnDamageOpts } from "../entity";
import { Water } from "../water";
import { BodyWireframe } from "../../mixins/bodyWireframe";
import globalFlags, { DebugLevel } from "../../flags";
import { IMediaInstance, Sound } from "@pixi/sound";
import { GameWorld, PIXELS_PER_METER, RapierPhysicsObject } from "../../world";
import { RigidBody, Vector2 } from "@dimforge/rapier2d-compat";
import { magnitude, MetersValue, mult, sub } from "../../utils";
import { AssetPack } from "../../assets";
import type { RecordedEntityState } from "../../state/model";
import { CameraLockPriority } from "../../camera";
import { BehaviorSubject, distinct, Observable } from "rxjs";
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

  /**
   * @deprecated Use safeUsePhys
   */
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

  protected sink() {
    this.isSinking = true;
    this.sinkingY = (this.body.translation().y + 10) * PIXELS_PER_METER;
    this.gameWorld.removeBody(this.physObject);
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
  }

  update(dt: number, _dMs: number): void {
    if (this.isSinking) {
      this.bodyMoving.next(false);
      log.debug("Setting new translation");
      this.sprite.y += PIXELS_PER_METER*(_dMs/500);
      if (this.sprite.y >= this.sinkingY) {
        this.destroy();
      }
      return;
    }

    this.safeUsePhys(({body}) => {
      this.bodyMoving.next(body.isMoving());
      const pos = body.translation();
      const rotation = body.rotation() + this.rotationOffset;
      this.sprite.updateTransform({
        x: pos.x * PIXELS_PER_METER + (this.renderOffset?.x ?? 0),
        y: pos.y * PIXELS_PER_METER + (this.renderOffset?.y ?? 0),
        rotation,
      });
  
      // Sinking.
      if (body.translation().y > this.gameWorld.waterYPosition) {
        log.debug('Splosh');
        this.sink();
        return;
      }
    
      this.wireframe.update();
    });
  }

  onCollision(_otherEnt: IPhysicalEntity, _contactPoint: Vector2) {
    if (_otherEnt instanceof Water) {
      return true;
    }
    return false;
  }

  onDamage(point: Vector2, radius: MetersValue, _opts: OnDamageOpts): void {
    this.safeUsePhys(({body}) => {
      const bodyTranslation = body.translation();
      const forceMag =
        radius.value / magnitude(sub(point, body.translation()));
      const force = mult(
        sub(point, bodyTranslation),
        new Vector2(-forceMag, -forceMag * 1.5),
      );
      body.applyImpulse(force, true);
    });
  }

  applyState(state: T): void {
    this.safeUsePhys(({body}) => {
      log.debug("Applying state", state);
      body.setTranslation(state.tra, true);
    });
    // this.body.setLinvel(state.vel, true);
    // this.body.setRotation(state.rot, true);
  }

  recordState(): T {
    if (this.destroyed) {
      throw Error("Can't record state of a destroyed entity");
    }
    if (this.isSinking) {
      return {
        type: -1,
        tra: {
          x: 0,
          y: 0,
        },
        rot: 0,
        vel: {
          x: 0,
          y: 0,
        },
        sinking: this.isSinking,
      } as T;
    }
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

  protected safeUsePhys(fn: (body: RapierPhysicsObject) => void) {
    if (this.isSinking || this.destroyed) {
      const stacktrace = new Error().stack;
      log.warning(`Tried to use body (for ${this.toString()}) after sinking / destroyed, this WILL CAUSE BUGS`, stacktrace);
      return;
    }
    fn(this.physObject);
  }
}
