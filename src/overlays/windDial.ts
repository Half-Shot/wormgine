import { Graphics } from "pixi.js";
import { applyGenericBoxStyle } from "../mixins/styles";
import { GameState } from "../logic/gamestate";
import { MAX_WIND } from "../world";

/**
 * Displays toast at the top of the screen during gameplay.
 */
export class WindDial {
    private readonly gfx: Graphics;
    public currentWind: number|null = null;

    public get container() {
        return this.gfx;
    }

    constructor(private readonly screenWidth: number, private readonly screenHeight: number, private gameState: GameState) {
        this.gfx = new Graphics();
    }

    public update() {
        if (this.currentWind !== null) {
            const windAbsDelta = Math.abs(this.gameState.currentWind - this.currentWind);
            if (windAbsDelta <= 0.1) {
                return;
            }
        } else {
            this.currentWind = 0;
        }
        this.gfx.clear();

        // Move progressively
        if (this.gameState.currentWind > this.currentWind) {
            this.currentWind += 0.05;
        } else if (this.gameState.currentWind < this.currentWind) {
            this.currentWind -= 0.05;
        }

        // Wind
        const windX = ((this.screenWidth / 20) * 16) + 14;
        const windY = ((this.screenHeight / 10) * 9) + 12;
        applyGenericBoxStyle(this.gfx).roundRect(
            windX, 
            windY,
            200,
            25,
            4
        ).stroke().fill();

        const windScale = this.currentWind / MAX_WIND;
        applyGenericBoxStyle(this.gfx).roundRect(
            (windScale >= 0 ? (windX + 100) : ((windX + 100) + (100*windScale))) + 2, 
            windY + 2,
            96 * Math.abs(windScale),
            21,
            4
        ).fill({ color: windScale > 0 ? 0xEE3333 : 0x3333EE });
        applyGenericBoxStyle(this.gfx).moveTo(windX + 100, windY).lineTo(windX + 100, windY+25).stroke();
    }
}
