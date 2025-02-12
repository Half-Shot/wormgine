import { TilingSprite, TilingSpriteOptions } from "pixi.js";
import Flags from "../flags";

interface TiledSpriteAnimatedOptions extends TilingSpriteOptions {
  columns: number;
  tileCount: number;
  fps: number;
  randomizeStartFrame: boolean;
}

export class TiledSpriteAnimated extends TilingSprite {
  private tileCounter = 0;
  private timeSinceLastAnim = 0;
  private readonly targetFrameMs;
  private readonly tileCount: number;
  private readonly columns: number;
  private debugStepAnim: string = "";
  constructor(opts: TiledSpriteAnimatedOptions) {
    super(opts);
    this.targetFrameMs = 1000 / opts.fps;
    this.tileCount = opts.tileCount;
    this.columns = opts.columns;
    if (opts.randomizeStartFrame) {
      this.tileCounter = Math.floor(Math.random() * this.tileCount);
    }
  }

  public get scaledWidth() {
    return this.width * this.scale.x;
  }
  public get scaledHeight() {
    return this.height * this.scale.y;
  }

  public update(deltaMs: number) {
    this.timeSinceLastAnim += deltaMs;
    if (Flags.stepAnimationsId) {
      if (this.debugStepAnim === Flags.stepAnimationsId) {
        return;
      }
      this.debugStepAnim = Flags.stepAnimationsId;
    } else if (this.timeSinceLastAnim < this.targetFrameMs) {
      return;
    }
    this.timeSinceLastAnim = 0;
    this.tileCounter += 1;
    if (this.tileCounter === this.tileCount) {
      this.tileCounter = 0;
    }
    // XXX: This is buggy. Using max helped to stop gittery anims.
    const tileColumn = Math.max(1, this.tileCounter % this.columns);
    const tileRow = Math.floor(this.tileCounter / this.columns);
    this.tilePosition.x = tileColumn * this.width;
    this.tilePosition.y = tileRow * this.height;
  }
}
