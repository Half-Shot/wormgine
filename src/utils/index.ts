import { Vector, Vector2 } from "@dimforge/rapier2d-compat";
export { Coordinate, MetersValue } from "./coodinate";

export function magnitude(v: Vector) {
  return Math.sqrt(Math.pow(Math.abs(v.x), 2) + Math.pow(Math.abs(v.y), 2));
}

export function add(a: Vector, b: Vector) {
  return new Vector2(a.x + b.x, a.y + b.y);
}

export function sub(a: Vector, b: Vector) {
  return new Vector2(a.x - b.x, a.y - b.y);
}

export function mult(a: Vector, b: Vector | number) {
  const bVec = typeof b === "number" ? { x: b, y: b } : b;
  return new Vector2(a.x * bVec.x, a.y * bVec.y);
}

export function pointOnRadius(
  originX: number,
  originY: number,
  radians: number,
  radius: number,
): Vector2 {
  const x = Math.cos(radians) * radius;
  const y = Math.sin(radians) * radius;
  return new Vector2(originX + x, originY + y);
}

export function angleForVector({ x, y }: Vector) {
  // https://www.omnicalculator.com/math/vector-direction
  return Math.atan2(y, x);
}


export function randomChoice<T>(
  options: T[],
) {
  return options[Math.floor(Math.random() * options.length)];
}


export function shuffle<T>(
  options: T[],
) {
  return options.slice(0).sort(() => Math.random() <= 0.5 ? 1 : -1);
}
