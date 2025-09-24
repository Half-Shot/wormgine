import { Texture, TilingSprite, TilingSpriteOptions } from "pixi.js";
import Flags from "../flags";
import Logger from "../log";

interface TiledSpriteAnimatedOptions extends TilingSpriteOptions {
  columns: number;
  tileCount: number;
  fps: number;
  randomizeStartFrame?: boolean;
}

export class TiledSpriteAnimated extends TilingSprite {
  public tileCounter = 0;
  private timeSinceLastAnim = 0;
  private readonly targetFrameMs;
  protected tileCount: number;
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
    if (!this.visible || this.destroyed) {
      return;
    }
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

interface PlaylistItem {
  texture: Texture;
  tileCount: number;
  loop?: true;
}

export class SequencedTiledSpriteAnimated extends TiledSpriteAnimated {
  private isLooping = false;
  private hasPlayedFirstFrame = false;
  private static log = new Logger("SequencedTiledSpriteAnimated");

  public get hasNextAnimation() {
    return this.playlist.length !== 0;
  }

  constructor(
    opts: TiledSpriteAnimatedOptions,
    private readonly playlist: PlaylistItem[],
  ) {
    super(opts);
    this.loadNextAnim();
  }

  public loadNextAnim() {
    const [next] = this.playlist.splice(0, 1);
    if (!next) {
      throw Error(
        "Unepected loadNextAnim when no items are left in the sequence",
      );
      return;
    }
    this.texture = next.texture;
    this.tileCount = next.tileCount;
    this.isLooping = next.loop ?? false;
    this.hasPlayedFirstFrame = false;
    SequencedTiledSpriteAnimated.log.debug(
      "Loaded next animation",
      this.texture.label,
      this.tileCount,
      this.isLooping,
    );
  }

  public update(deltaMs: number): void {
    if (this.tileCounter > 0 && !this.hasPlayedFirstFrame) {
      this.hasPlayedFirstFrame = true;
    }
    if (!this.isLooping && this.tileCounter === 0 && this.hasPlayedFirstFrame) {
      if (!this.hasNextAnimation) {
        // Skip any animations if this has played out.
        SequencedTiledSpriteAnimated.log.debug("Animation played out");
        return;
      }
      this.loadNextAnim();
    }
    super.update(deltaMs);
  }

  public endLoop() {
    this.isLooping = false;
  }
}
