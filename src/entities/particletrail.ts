import {
  Color,
  Container,
  Graphics,
  ObservablePoint,
  Point,
  UPDATE_PRIORITY,
} from "pixi.js";
import { IGameEntity } from "./entity";

/**
 * Standard, reusable particle trail.
 */
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
    kind: "fire" | "pop";
  }[] = [];

  static create(
    container: Container,
    parent: ObservablePoint,
    parentObject: IGameEntity,
  ) {
    const ent = new ParticleTrail(parent, parentObject);
    container.addChild(ent.gfx);
    return ent;
  }

  private constructor(
    private readonly parent: ObservablePoint,
    private readonly parentObject: IGameEntity,
  ) {
    this.gfx = new Graphics();
  }

  update(dt: number) {
    const xSpeed = Math.random() * 0.5 - 0.25;
    const kind = Math.random() >= 0.75 ? "fire" : "pop";
    if (!this.parentObject.destroyed) {
      this.trail.push({
        alpha: 1,
        point: this.parent.clone(),
        speed: new Point(xSpeed, 0.5),
        accel: new Point(
          // Invert the accel
          xSpeed / 2,
          0.25,
        ),
        radius: 1 + Math.random() * (kind === "pop" ? 4.5 : 2.5),
        kind,
      });
    }

    this.gfx.clear();

    const shrapnelHue = new Color(0xaaaaaa);
    for (const shrapnel of this.trail) {
      shrapnel.speed.x += shrapnel.accel.x * dt;
      shrapnel.speed.y += shrapnel.accel.y * dt;
      shrapnel.point.x += shrapnel.speed.x * dt;
      shrapnel.point.y += shrapnel.speed.y * dt;
      shrapnel.alpha = Math.max(0, shrapnel.alpha - Math.random() * dt * 0.03);
      if (shrapnel.alpha === 0) {
        this.trail.splice(this.trail.indexOf(shrapnel), 1);
      }
      if (shrapnel.kind === "pop") {
        this.gfx
          .circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius)
          .fill({ color: shrapnelHue, alpha: shrapnel.alpha });
      } else {
        this.gfx
          .circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius)
          .fill({ color: 0xfd4301, alpha: shrapnel.alpha });
        this.gfx
          .circle(shrapnel.point.x, shrapnel.point.y, shrapnel.radius - 3)
          .fill({ color: 0xfde101, alpha: shrapnel.alpha });
      }
    }
    if (this.trail.length === 0) {
      this.destroy();
    }
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
