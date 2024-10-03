import { Graphics, TextOptions } from "pixi.js";

export function applyGenericBoxStyle(gfx: Graphics) {
    return gfx.setStrokeStyle({
        width: 2,
        color: 0xAAAAAA,
        cap: 'butt',
        join: 'round',
    }).setFillStyle({ color: 0x111111, alpha: 0.95})
}

export const DefaultTextStyle = {
    fontFamily: 'Monogram',
    fontSize: 24,
    fill: 0xFFFFFF,
    align: 'left',
} as TextOptions["style"];