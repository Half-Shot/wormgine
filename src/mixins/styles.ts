import { ColorSource, Graphics, TextOptions } from "pixi.js";

export function applyGenericBoxStyle(gfx: Graphics, borderColor: ColorSource = 0xAAAAAA) {
    return gfx.setStrokeStyle({
        width: 2,
        color: borderColor,
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