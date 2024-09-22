import { Container, Graphics, Text, Ticker, UPDATE_PRIORITY } from "pixi.js";
import globalFlags from "./flags";
import RAPIER from "@dimforge/rapier2d";
import { PIXELS_PER_METER } from "./world";
import { Viewport } from "pixi-viewport";

export class GameDebugOverlay {
    private readonly fpsSamples: number[] = [];
    private readonly text: Text;
    private readonly tickerFn: (dt: Ticker) => void;
    private readonly rapierGfx: Graphics;

    constructor(
        private readonly rapierWorld: RAPIER.World,
        private readonly ticker: Ticker,
        private readonly stage: Container,
        private readonly viewport: Viewport,
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
        this.rapierGfx = new Graphics();
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
        this.stage.addChild(this.text);
        this.viewport.addChild(this.rapierGfx);
        this.ticker.add(this.tickerFn, undefined, UPDATE_PRIORITY.UTILITY);
    }

    private disableOverlay() {
        this.ticker.remove(this.tickerFn);
        this.stage.removeChild(this.text);
        this.viewport.removeChild(this.rapierGfx);
    }

    private update(dt: Ticker) {
        this.fpsSamples.splice(0, 0, dt.FPS);
        if (this.fpsSamples.length > dt.maxFPS) {
            this.fpsSamples.pop();
        }
        const avgFps = Math.round(this.fpsSamples.reduce((a,b) => a + b, 0) / this.fpsSamples.length);
        this.text.text = `FPS: ${avgFps} | Total bodies: ${this.rapierWorld.bodies.len()}`;

        let buffers = this.rapierWorld.debugRender();
        let vtx = buffers.vertices;
        let cls = buffers.colors;
        this.rapierGfx.clear();
        this.rapierGfx.setStrokeStyle({ width: 2, color: 0xFFFFFF });

        for (let i = 0; i < vtx.length / 4; i += 1) {
            const vtxA = vtx[i * 4] * PIXELS_PER_METER;
            const vtxB = vtx[i * 4 + 1] * PIXELS_PER_METER;
            const vtxC = vtx[i * 4 + 2] * PIXELS_PER_METER;
            const vtxD = vtx[i * 4 + 3] * PIXELS_PER_METER;
            const color = new Float32Array([
                cls[i * 8],
                cls[i * 8 + 1],
                cls[i * 8 + 2],
                cls[i * 8 + 3],
            ])
            this.rapierGfx.setStrokeStyle({width: 1, color }).moveTo(vtxA, vtxB).lineTo(vtxC, vtxD).stroke();
        }
    }
}