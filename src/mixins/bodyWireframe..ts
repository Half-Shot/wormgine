import { Graphics, Text } from "pixi.js";
import { PIXELS_PER_METER, RapierPhysicsObject } from "../world";
import { Ball, Cuboid } from "@dimforge/rapier2d-compat";
import { DefaultTextStyle } from "./styles";

export class BodyWireframe {
  private gfx = new Graphics();
  private debugText = new Text({
    text: "",
    style: {
      ...DefaultTextStyle,
      fontSize: 16,
      align: "center",
    },
  });

  private shouldRender: boolean;
  public set enabled(value: boolean) {
    this.shouldRender = value;
    this.debugText.visible = value;
    this.gfx.visible = value;
  }

  public get enabled() {
    return this.shouldRender;
  }

  public get renderable() {
    return this.gfx;
  }

  private readonly width: number;
  private readonly height: number;

  constructor(
    private parent: RapierPhysicsObject,
    enabled = true,
  ) {
    this.gfx.addChild(this.debugText);
    if (parent.collider.shape instanceof Cuboid) {
      this.width = parent.collider.shape.halfExtents.x * 2 * PIXELS_PER_METER;
      this.height = parent.collider.shape.halfExtents.y * 2 * PIXELS_PER_METER;
    } else if (parent.collider.shape instanceof Ball) {
      this.width = this.height =
        parent.collider.shape.radius * 2 * PIXELS_PER_METER;
    } else {
      // Unknown shape.
      this.width = 1;
      this.height = 1;
    }
    this.debugText.position.x = this.width + 5;

    // To make TS happy.
    this.shouldRender = enabled;
    this.enabled = enabled;
  }

  setDebugText(text: string) {
    this.debugText.text = text;
  }

  update() {
    // TODO: Wasteful?
    this.gfx.clear();
    if (!this.shouldRender) {
      return;
    }
    this.gfx
      .circle(this.width / 2, this.height / 2, 3)
      .stroke({ width: 1, color: 0xff0000 });
    if (this.parent.collider.shape instanceof Ball === false) {
      this.gfx.rect(0, 0, this.width, this.height);
    } else {
      this.gfx.circle(this.width / 2, this.height / 2, this.width);
    }
    const t = this.parent.body.translation();
    this.gfx.updateTransform({
      x: t.x * PIXELS_PER_METER - this.width / 2,
      y: t.y * PIXELS_PER_METER - this.height / 2,
      // rotation: this.body.angle,
      // pivotX: globalWindow.debugPivotModX,
      // pivotY: globalWindow.debugPivotModY,
    });
  }
}
