import { Vector2 } from "@dimforge/rapier2d-compat";
import { PIXELS_PER_METER } from "../world";

export class MetersValue {
    static fromPixels(pixels: number) {
        return new MetersValue(pixels / PIXELS_PER_METER);
    }
    constructor (public value: number) {

    }

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
        return `MetersValue {meters: ${this.value}, pixels: ${this.value}}`
    }
}

export class Coordinate {

    static fromScreen(screenX: number, screenY: number) {
        return new Coordinate(screenX / PIXELS_PER_METER, screenY / PIXELS_PER_METER);
    }


    static fromWorld(vec: Vector2) {
        return new Coordinate(vec.x, vec.y);
    }

    constructor(public worldX: number, public worldY: number) { }


    toWorldVector(): Vector2 {
        return new Vector2(this.worldX, this.worldY);
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
        return `Coodinate {wx: ${this.worldX} wy:${this.worldY}} {sx: ${this.screenX}, sy: ${this.screenY}}`
    }
}