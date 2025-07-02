import {
  ColorSource,
  Container,
  Graphics,
  ObservablePoint,
  Point,
  PointData,
  UPDATE_PRIORITY,
} from "pixi.js";
import { IGameEntity } from "./entity";
import { PhysicsEntity } from "./phys/physicsEntity";
import { randomChoice } from "../utils";

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
};

export class ParticleTrail implements IGameEntity {
  priority = UPDATE_PRIORITY.LOW;

  public get destroyed() {
    return this.gfx.destroyed;
  }
  private readonly gfx: Graphics;
  private trail: {
    point: Point;
    speed: Point;
    accel: Point;
    radius: number;
    alpha: number;
    color: ColorSource;
  }[] = [];

  static create(
    container: Container,
    parent: ObservablePoint,
    parentObject: PhysicsEntity,
    opts: Partial<Opts> = DEFAULT_OPTS,
  ) {
    const ent = new ParticleTrail(parent, parentObject, {
      ...DEFAULT_OPTS,
      ...opts,
    });
    container.addChild(ent.gfx);
    return ent;
  }

  private readonly chanceArray: { color: ColorSource; size: number }[];

  private constructor(
    private readonly parent: ObservablePoint,
    private readonly parentObject: PhysicsEntity,
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
    if (!this.parentObject.destroyed && !this.parentObject.sinking) {
      this.trail.push({
        alpha: 1,
        point: this.parent.clone(),
        speed: new Point(
          xSpeedRandMod * this.opts.initialSpeed.x,
          this.opts.initialSpeed.y,
        ),
        accel: new Point(
          // Invert the accel
          this.opts.acceleration.x,
          this.opts.acceleration.y,
        ),
        radius: 1 + Math.random() * size,
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
