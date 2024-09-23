import { Vector, Vector2 } from "@dimforge/rapier2d";
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

export function mult(a: Vector, b: Vector) {
    return new Vector2(a.x * b.x, a.y * b.y);
}