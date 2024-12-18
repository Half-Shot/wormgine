import {
  UPDATE_PRIORITY,
  Ticker,
  Sprite,
  ColorSource,
  Container,
} from "pixi.js";
import { IPhysicalEntity, IWeaponEntity } from "../entity";
import { PhysicsEntity } from "./physicsEntity";
import { GameWorld, RapierPhysicsObject } from "../../world";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { MetersValue } from "../../utils/coodinate";
import { WeaponFireResult } from "../../weapons/weapon";
import { WormInstance } from "../../logic/teams";
import { handleDamageInRadius } from "../../utils/damage";
import { RecordedEntityState } from "../../state/model";

interface Opts {
  explosionRadius: MetersValue;
  explodeOnContact: boolean;
  explosionHue?: ColorSource;
  explosionShrapnelHue?: ColorSource;
  autostartTimer: boolean;
  timerSecs?: number;
  ownerWorm?: WormInstance;
  maxDamage: number;
}

export interface TimedExplosiveRecordedState extends RecordedEntityState {
  owner?: string;
  timerSecs?: number;
  timer?: number;
}

/**
 * Any projectile type that can explode after a set timer. Implementing classes
 * must include their own timer.
 */
export abstract class TimedExplosive
  extends PhysicsEntity<TimedExplosiveRecordedState>
  implements IWeaponEntity
{
  protected timer: number | undefined;
  protected hasExploded = false;

  private fireResultFn!: (fireResult: WeaponFireResult[]) => void;
  public onFireResult: Promise<WeaponFireResult[]>;

  priority = UPDATE_PRIORITY.NORMAL;

  constructor(
    sprite: Sprite,
    body: RapierPhysicsObject,
    gameWorld: GameWorld,
    private readonly parent: Container,
    protected readonly opts: Opts,
  ) {
    super(sprite, body, gameWorld);
    this.gameWorld.addBody(this, body.collider);
    if (opts.autostartTimer) {
      this.timer = opts.timerSecs
        ? Ticker.targetFPMS * opts.timerSecs * 1000
        : 0;
    }
    // TODO: timeout.
    this.onFireResult = new Promise((r) => (this.fireResultFn = r));
  }

  startTimer() {
    if (this.timer !== undefined) {
      throw Error("Timer already started");
    }
    if (!this.opts.timerSecs) {
      throw Error("No timer secs defined");
    }
    this.timer = Ticker.targetFPMS * this.opts.timerSecs * 1000;
  }

  onTimerFinished() {
    if (!this.physObject || !this.gameWorld) {
      throw Error("Timer expired without a body");
    }
    this.onExplode();
  }

  onExplode() {
    if (this.hasExploded) {
      throw Error("Tried to explode twice");
    }
    this.hasExploded = true;
    this.timer = undefined;
    const result = handleDamageInRadius(
      this.gameWorld,
      this.parent,
      this.body.translation(),
      this.opts.explosionRadius,
      {
        shrapnelMax: 35,
        shrapnelMin: 15,
        hue: this.opts.explosionHue ?? 0xffffff,
        shrapnelHue: this.opts.explosionShrapnelHue ?? 0xffffff,
      },
      this.physObject.collider,
      this.opts.ownerWorm,
    );
    this.fireResultFn(result);
    this.destroy();
  }

  update(dt: number): void {
    super.update(dt);
    if (this.timer !== undefined) {
      if (this.timer > 0) {
        this.timer -= dt;
      } else if (this.timer <= 0 && !this.isSinking) {
        this.onTimerFinished();
      }
    }
  }

  onCollision(otherEnt: IPhysicalEntity, contactPoint: Vector2) {
    if (super.onCollision(otherEnt, contactPoint)) {
      if (this.isSinking) {
        this.timer = 0;
        this.physObject.body.setRotation(0.15, false);
        this.fireResultFn([WeaponFireResult.NoHit]);
      }
      return true;
    }

    if (this.opts.explodeOnContact && !this.hasExploded) {
      this.onExplode();
      return true;
    }

    return false;
  }

  recordState() {
    return {
      // No floats.
      timer: this.timer && Math.round(this.timer),
      owner: this.opts.ownerWorm?.uuid,
      timerSecs: this.opts.timerSecs,
      ...super.recordState(),
    };
  }

  loadState(d: TimedExplosiveRecordedState) {
    super.loadState(d);
    this.timer = d.timer;
    this.opts.timerSecs = d.timerSecs;
  }
}
