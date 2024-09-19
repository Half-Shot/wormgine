import { Container, Text, Ticker, UPDATE_PRIORITY } from "pixi.js";
import globalFlags from "./flags";
import RAPIER from "@dimforge/rapier2d";

export class GameDebugOverlay {
    private readonly fpsSamples: number[] = [];
    private readonly text: Text;
    private readonly tickerFn: (dt: Ticker) => void;

    constructor(
        private readonly rapierWorld: RAPIER.World,
        private readonly ticker: Ticker,
        private readonly viewport: Container
    ) {
        this.text = new Text({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 20,
                fill: 0xFFFFFF,
                align: 'center',
            },
        });
        this.tickerFn = this.update.bind(this);
        globalFlags.on('toggleDebugView', (enabled) => {
            if (enabled) {
                this.enableOverlay();
            } else {
                this.disableOverlay();
            }
        });
        if (globalFlags.DebugView) {
            this.enableOverlay();
        }
    }

    private enableOverlay() {
        this.viewport.addChild(this.text);
        this.ticker.add(this.tickerFn, undefined, UPDATE_PRIORITY.UTILITY);
    }

    private disableOverlay() {
        this.ticker.remove(this.tickerFn);
        this.viewport.removeChild(this.text);
    }

    private update(dt: Ticker) {
        this.fpsSamples.splice(0, 0, dt.FPS);
        if (this.fpsSamples.length > dt.maxFPS) {
            this.fpsSamples.pop();
        }
        const avgFps = Math.round(this.fpsSamples.reduce((a,b) => a + b, 0) / this.fpsSamples.length);
        this.text.text = `FPS: ${avgFps} | Total bodies: ${this.rapierWorld.bodies.len()}`;
    }
}