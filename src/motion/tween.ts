import { RigidBody, Vector2 } from "@dimforge/rapier2d-compat";
import { Coordinate } from "../utils";

export class TweenEngine {
  private duration: number = 0;

  constructor(
    private readonly body: RigidBody,
    /**
     * Amount of distance travelled per ms, in both directions.
     */
    private readonly speed: Vector2,
    private readonly to: Coordinate,
    private readonly from = Coordinate.fromWorld(body.translation()),
  ) {}

  public update(deltaMs: number): boolean {
    this.duration += deltaMs;

    const t = this.body.translation();
    let x = t.x;
    let y = t.y;

    let complete = false;

    if (this.to.worldX > this.from.worldX) {
      x = this.from.worldX + this.speed.x * this.duration;
      x = Math.min(x, this.to.worldX);
    } else if (this.to.worldX < this.from.worldX) {
      x = this.from.worldX + -this.speed.x * this.duration;
      x = Math.max(x, this.to.worldX);
    } else {
      // Do nothing.
      complete = true;
    }

    if (this.to.worldY > this.from.worldY) {
      y = this.from.worldY + this.speed.y * this.duration;
      y = Math.min(y, this.to.worldY);
    } else if (this.to.worldY < this.from.worldY) {
      y = this.from.worldY + -this.speed.y * this.duration;
      y = Math.max(y, this.to.worldY);
    } else {
      // Do nothing.
      if (complete) {
        return true;
      }
    }

    this.body.setTranslation({ x, y }, true);

    return false;
  }
}
