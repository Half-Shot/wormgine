import { Graphics } from "pixi.js";

export function applyGenericBoxStyle(gfx: Graphics) {
    return gfx.setStrokeStyle({
        width: 2,
        color: 0xAAAAAA,
        cap: 'butt',
        join: 'round',
    }).setFillStyle({ color: 0xAAAAAA, alpha: 0.25})
}