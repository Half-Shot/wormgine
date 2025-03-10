import {
  ColorSource,
  Container,
  Graphics,
  Point,
  Text,
  Ticker,
  UPDATE_PRIORITY,
} from "pixi.js";
import globalFlags, { DebugLevel } from "../flags";
import RAPIER from "@dimforge/rapier2d-compat";
import { PIXELS_PER_METER } from "../world";
import { Viewport } from "pixi-viewport";
import { debugData } from "../movementController";
import { DefaultTextStyle } from "../mixins/styles";
import { RunningNetGameInstance } from "../net/netgameinstance";

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
  private mouseMoveListener: (e: MouseEvent) => void;

  private readonly textFields = new Set<{ text: string }>();

  private static registeredDebugPoints: Record<
    string,
    { points: Point[]; color: ColorSource }
  > = {};

  constructor(
    private readonly rapierWorld: RAPIER.World,
    private readonly ticker: Ticker,
    private readonly stage: Container,
    private readonly viewport: Viewport,
    private readonly gameInstance?: RunningNetGameInstance,
  ) {
    this.text = new Text({
      text: "",
      style: {
        ...DefaultTextStyle,
        fontSize: 20,
      },
    });
    this.rapierGfx = new Graphics();
    this.tickerFn = this.update.bind(this);
    globalFlags.on("toggleDebugView", this.toggleDebugView);
    if (globalFlags.DebugView) {
      this.enableOverlay();
    }
    this.mouseMoveListener = async (evt: MouseEvent) => {
      const pos = this.viewport.toWorld(new Point(evt.clientX, evt.clientY));
      this.mouse = pos;
    };
  }

  public addTextField() {
    const newTextField = { text: "" };
    this.textFields.add(newTextField);
    return newTextField;
  }

  private toggleDebugView = (level: DebugLevel) => {
    if (level !== DebugLevel.None) {
      this.enableOverlay();
    } else {
      this.disableOverlay();
    }
  };

  private enableOverlay() {
    this.stage.addChild(this.text);
    this.viewport.addChild(this.rapierGfx);
    this.ticker.add(this.tickerFn, undefined, UPDATE_PRIORITY.UTILITY);
    window.addEventListener("mousemove", this.mouseMoveListener);
  }

  private disableOverlay() {
    this.ticker.remove(this.tickerFn);
    this.stage.removeChild(this.text);
    this.viewport.removeChild(this.rapierGfx);
    window.removeEventListener("mousemove", this.mouseMoveListener);
  }

  public destroy() {
    this.disableOverlay();
    globalFlags.off("toggleDebugView", this.toggleDebugView);
  }

  private update(dt: Ticker) {
    this.fpsSamples.splice(0, 0, dt.FPS);
    while (this.fpsSamples.length > FRAME_SAMPLES) {
      this.fpsSamples.pop();
    }
    const avgFps = Math.round(
      this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length,
    );
    while (this.physicsSamples.length > PHYSICS_SAMPLES) {
      this.physicsSamples.pop();
    }

    const avgPhysicsCostMs =
      Math.ceil(
        (this.physicsSamples.reduce((a, b) => a + b, 0) /
          (this.physicsSamples.length || 1)) *
        100,
      ) / 100;

    this.text.text = [
      `FPS: ${avgFps}`,
      `Physics time: ${avgPhysicsCostMs}ms`,
      `Total bodies: ${this.rapierWorld.bodies.len()}`,
      `Mouse: ${Math.round(this.mouse.x)} ${Math.round(this.mouse.y)}`,
      `Ticker fns: ${this.ticker.count}`,
    ].concat(this.textFields.values().filter(v => !!v.text).map(v => v.text).toArray()).join(' | ')

    this.skippedUpdatesTarget = 180 / avgFps;

    if (this.skippedUpdatesTarget >= this.skippedUpdates) {
      this.skippedUpdates++;
      return;
    }
    this.skippedUpdates = 0;

    this.rapierGfx.clear();
    if (debugData) {
      const castWidth = debugData.shape.halfExtents.x * PIXELS_PER_METER;
      const castHeight = debugData.shape.halfExtents.y * PIXELS_PER_METER;

      this.rapierGfx
        .setStrokeStyle({
          color: "green",
          width: 3,
        })
        .rect(
          debugData.rayCoodinate.screenX - castWidth,
          debugData.rayCoodinate.screenY - castHeight,
          castWidth * 2,
          castHeight * 2,
        )
        .stroke();
    }

    for (const data of Object.values(GameDebugOverlay.registeredDebugPoints)) {
      this.rapierGfx.setFillStyle({ color: data.color });
      for (const circle of data.points) {
        this.rapierGfx.circle(circle.x, circle.y, 5);
      }
    }

    if (globalFlags.DebugView === DebugLevel.PhysicsOverlay) {
      this.renderPhysicsOverlay();
    }
  }

  private renderPhysicsOverlay() {
    const buffers = this.rapierWorld.debugRender();
    const vtx = buffers.vertices;
    const cls = buffers.colors;

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
      ]);
      this.rapierGfx
        .setStrokeStyle({ width: 1, color })
        .moveTo(vtxA, vtxB)
        .lineTo(vtxC, vtxD)
        .stroke();
    }
  }

  public static registerDebugData(name: string, color: ColorSource): Point[] {
    const points: Point[] = [];
    this.registeredDebugPoints[name] = { color, points };
    return points;
  }
}
