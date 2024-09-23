import { Vector, Vector2 } from "@dimforge/rapier2d";
export { Coordinate, MetersValue } from "./coodinate";



export function magnitude(v: Vector) {    
    return Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2));
}

export function add(a: Vector, b: Vector) {
    return new Vector2(a.x + b.x, a.y + b.y);
}