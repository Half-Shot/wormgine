import {
  ColorSource,
  Graphics,
  ObservablePoint,
  Point,
  PointData,
  UPDATE_PRIORITY,
  ViewContainer,
} from "pixi.js";
import { IGameEntity } from "./entity";
import { PhysicsEntity } from "./phys/physicsEntity";
import { randomChoice } from "../utils";
import { RecordedEntityState } from "../state/model";

/**
 * Standard, reusable particle trail.
 */

interface Opts {
  colours: {
    color: ColorSource;
    chance: number;
    size: number;
  }[];
  initialSpeed: PointData;
  acceleration: PointData;
  offset: PointData;
  count: number;
}

const DEFAULT_OPTS: Opts = {
  colours: [
    {
      color: 0xaaaaaa,
      chance: 7,
      size: 5,
    },
    {
      color: 0xfd4301,
      chance: 2,
      size: 3,
    },
    {
      color: 0xfde101,
      chance: 1,
      size: 2,
    },
  ],
  initialSpeed: {
    x: 1,
    y: 0.5,
  },
  acceleration: {
    x: 0,
    y: 0.15,
  },
  offset: {
    x: 0,
    y: 0,
  },
  count: 50,
};

export class ParticleTrail implements IGameEntity {
  priority = UPDATE_PRIORITY.LOW;
  public scale = 1;

  public get destroyed() {
    return this.gfx.destroyed;
  }
  public readonly gfx: Graphics;
  private trail: {
    point: Point;
    speed: Point;
    accel: Point;
    radius: number;
    alpha: number;
    color: ColorSource;
  }[] = [];

  static create(
    parent: ObservablePoint,
    parentObject: PhysicsEntity<RecordedEntityState, ViewContainer>,
    opts: Partial<Opts> = DEFAULT_OPTS,
  ) {
    const ent = new ParticleTrail(parent, parentObject, {
      ...DEFAULT_OPTS,
      ...opts,
    });
    return ent;
  }

  private readonly chanceArray: { color: ColorSource; size: number }[];

  private constructor(
    private readonly parent: ObservablePoint,
    private readonly parentObject: PhysicsEntity<
      RecordedEntityState,
      ViewContainer
    >,
    private readonly opts: Opts,
  ) {
    this.gfx = new Graphics();
    this.chanceArray = [];
    for (const { color, chance, size } of opts.colours) {
      this.chanceArray.push(
        ...Array.from({ length: chance }).map(() => ({ color, size })),
      );
    }
  }

  update(dt: number) {
    const xSpeedRandMod = Math.random() * 0.5 - 0.25;
    const { color, size } = randomChoice(this.chanceArray);
    const requiredCount = this.opts.count * this.scale;
    if (
      !this.parentObject.destroyed &&
      !this.parentObject.sinking &&
      this.trail.length < requiredCount
    ) {
      this.trail.push({
        alpha: 1,
        point: new Point(
          this.parent.x + this.opts.offset.x,
          this.parent.y + this.opts.offset.y,
        ),
        speed: new Point(
          xSpeedRandMod * this.opts.initialSpeed.x,
          this.opts.initialSpeed.y,
        ),
        accel: new Point(
          // Invert the accel
          this.opts.acceleration.x,
          this.opts.acceleration.y,
        ),
        radius: 1 + Math.random() * size * this.scale,
        color,
      });
    }

    this.gfx.clear();

    for (const shrapnel of this.trail) {
      shrapnel.speed.x += shrapnel.accel.x * dt;
      shrapnel.speed.y += shrapnel.accel.y * dt;
      shrapnel.point.x += shrapnel.speed.x * dt;
      shrapnel.point.y += shrapnel.speed.y * dt;
      shrapnel.alpha = Math.max(0, shrapnel.alpha - Math.random() * dt * 0.03);
      if (shrapnel.alpha === 0) {
        this.trail.splice(this.trail.indexOf(shrapnel), 1);
      }
      this.gfx
        .circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius)
        .fill({ color: shrapnel.color, alpha: shrapnel.alpha });
    }
    if (this.trail.length === 0) {
      this.destroy();
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
