import { Vector2 } from "@dimforge/rapier2d";
import { Point } from "pixi.js";

export function magnitude(v: Vector2|Point) {    
    return Math.sqrt(Math.pow(v.x, 2) + Math.pow(v.y, 2));
}