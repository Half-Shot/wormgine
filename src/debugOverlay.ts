import { Container, Graphics, Point, Text, Ticker, UPDATE_PRIORITY } from "pixi.js";
import globalFlags from "./flags";
import RAPIER from "@dimforge/rapier2d-compat";
import { PIXELS_PER_METER } from "./world";
import { Viewport } from "pixi-viewport";

const PHYSICS_SAMPLES = 60;
const FRAME_SAMPLES = 60;

export class GameDebugOverlay {
    private readonly fpsSamples: number[] = [];
    public readonly physicsSamples: number[] = [];
    private readonly text: Text;
    private readonly tickerFn: (dt: Ticker) => void;
    private readonly rapierGfx: Graphics;

    private skippedUpdates = 0;
    private skippedUpdatesTarget = 0;
    private mouse: Point = new Point();
    private mouseMoveListener: any;

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
        this.mouseMoveListener = async (evt: MouseEvent) => {
            const pos = this.viewport.toWorld(new Point(evt.clientX, evt.clientY));
            this.mouse = pos;
        };
    }

    private enableOverlay() {
        this.stage.addChild(this.text);
        this.viewport.addChild(this.rapierGfx);
        this.ticker.add(this.tickerFn, undefined, UPDATE_PRIORITY.UTILITY);
        window.addEventListener('mousemove', this.mouseMoveListener);
    }

    private disableOverlay() {
        this.ticker.remove(this.tickerFn);
        this.stage.removeChild(this.text);
        this.viewport.removeChild(this.rapierGfx);
        window.removeEventListener('mousemove', this.mouseMoveListener);
    }

    private update(dt: Ticker) {
        this.fpsSamples.splice(0, 0, dt.FPS);
        while (this.fpsSamples.length > FRAME_SAMPLES) {
            this.fpsSamples.pop();
        }
        const avgFps = Math.round(this.fpsSamples.reduce((a,b) => a + b, 0) / this.fpsSamples.length);
        while (this.physicsSamples.length > PHYSICS_SAMPLES) {
            this.physicsSamples.pop();
        }

        const avgPhysicsCostMs = Math.ceil(this.physicsSamples.reduce((a,b) => a + b, 0) / (this.physicsSamples.length || 1) * 100)/100;

        this.text.text = `FPS: ${avgFps} | Physics time: ${avgPhysicsCostMs}ms| Total bodies: ${this.rapierWorld.bodies.len()} | mouse: ${Math.round(this.mouse.x)} ${Math.round(this.mouse.y)}`;

        this.skippedUpdatesTarget = (180/avgFps);

        if (this.skippedUpdatesTarget >= this.skippedUpdates) {
            this.skippedUpdates++;
            return;
        }
        this.skippedUpdates = 0;

        let buffers = this.rapierWorld.debugRender();
        let vtx = buffers.vertices;
        let cls = buffers.colors;


        this.rapierGfx.clear();

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