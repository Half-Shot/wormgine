import { Vector2 } from "@dimforge/rapier2d-compat";
import { PIXELS_PER_METER } from "../world";
import { Point } from "pixi.js";

export class MetersValue {
  static fromPixels(pixels: number) {
    return new MetersValue(pixels / PIXELS_PER_METER);
  }
  constructor(public value: number) {}

  set pixels(value: number) {
    this.value = value / PIXELS_PER_METER;
  }

  get pixels() {
    return this.value * PIXELS_PER_METER;
  }

  public valueOf() {
    return this.value;
  }

  public toString() {
    return `{${this.value}m, ${this.value}px}`;
  }
}
export class Coordinate {
  static fromScreen(screenX: number, screenY: number) {
    return new Coordinate(
      screenX / PIXELS_PER_METER,
      screenY / PIXELS_PER_METER,
    );
  }

  static fromWorld(x: number, y: number): Coordinate;
  static fromWorld(vec: Vector2): Coordinate;

  static fromWorld(vec: Vector2 | number, y?: number) {
    if (typeof vec === "object") {
      return new Coordinate(vec.x, vec.y);
    }
    if (typeof y !== "number") {
      throw Error("Expected y to be a number");
    }
    return new Coordinate(vec, y);
  }

  constructor(
    public worldX: number,
    public worldY: number,
  ) {}

  toWorldVector(): Vector2 {
    return new Vector2(this.worldX, this.worldY);
  }

  toScreenPoint(): Point {
    return new Point(this.screenX, this.screenY);
  }

  get screenX() {
    return this.worldX * PIXELS_PER_METER;
  }

  set screenX(value: number) {
    this.worldX = value / PIXELS_PER_METER;
  }

  get screenY() {
    return this.worldY * PIXELS_PER_METER;
  }

  set screenY(value: number) {
    this.worldX = value / PIXELS_PER_METER;
  }

  public toString() {
    return `Coodinate {wx: ${this.worldX} wy:${this.worldY}} {sx: ${this.screenX}, sy: ${this.screenY}}`;
  }

  public hash() {
    // Cloes enough approximation.
    return this.worldX + this.worldY * 575;
  }
}
