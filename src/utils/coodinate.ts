import { PIXELS_PER_METER } from "../world";

export class MetersValue {
    constructor (public value: number) {

    }

    set pixels(value: number) {
        this.value = value / PIXELS_PER_METER;
    }

    get pixels() {
        return this.value * PIXELS_PER_METER;
    }
}

export class Coordinate {

    static fromScreen(screenX: number, screenY: number) {
        return new Coordinate(screenX / PIXELS_PER_METER, screenY / PIXELS_PER_METER);
    }

    constructor(public worldX: number, public worldY: number) { }

    get screenX() {
        return this.worldX * PIXELS_PER_METER;
    }

    get screenY() {
        return this.worldY * PIXELS_PER_METER;
    }

    set screenX(value: number) {
        this.worldX = value / PIXELS_PER_METER;
    }

    set screenY(value: number) {
        this.worldX = value / PIXELS_PER_METER;
    }
}