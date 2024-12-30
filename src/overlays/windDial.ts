import { Container, Graphics, Texture, TilingSprite } from "pixi.js";
import { applyGenericBoxStyle } from "../mixins/styles";
import { GameWorld, MAX_WIND } from "../world";
import { AssetTextures } from "../assets/manifest";

/**
 * Displays toast at the top of the screen during gameplay.
 */
export class WindDial {
  public static loadAssets(textures: AssetTextures) {
    this.texture = textures.windScroll;
  }
  private static texture: Texture;

  private readonly gfx: Graphics;
  public readonly container: Container;
  private readonly windScroller: TilingSprite;
  public currentWind: number | null = null;
  private readonly windX: number;
  private readonly windY: number;

  constructor(
    x: number,
    y: number,
    private world: GameWorld,
  ) {
    this.gfx = new Graphics({});

    this.windX = x + 14;
    this.windY = y + 12;
    this.windScroller = new TilingSprite({
      texture: WindDial.texture,
      width: 0,
      height: 16,
      x: this.windX,
      y: this.windY + 4,
      tint: 0xffffff,
      alpha: 1,
      tileScale: {
        x: 0.08,
        y: 0.08,
      },
    });
    this.container = new Container({});
    this.container.addChild(this.gfx, this.windScroller);
  }

  public update() {
    if (this.currentWind !== null) {
      this.windScroller.tilePosition.x += this.currentWind * 0.1;
      const windAbsDelta = Math.abs(this.world.wind - this.currentWind);
      if (windAbsDelta <= 0.1) {
        return;
      }
    } else {
      this.currentWind = 0;
    }
    this.gfx.clear();

    // Move progressively
    if (this.world.wind > this.currentWind) {
      this.currentWind += 0.1;
    } else if (this.world.wind < this.currentWind) {
      this.currentWind -= 0.1;
    }

    applyGenericBoxStyle(this.gfx)
      .roundRect(this.windX, this.windY, 200, 25, 4)
      .stroke()
      .fill();

    const windScale = this.currentWind / MAX_WIND;
    const boxX =
      (windScale >= 0 ? this.windX + 100 : this.windX + 100 + 100 * windScale) +
      2;
    applyGenericBoxStyle(this.gfx)
      .roundRect(boxX, this.windY + 2, 96 * Math.abs(windScale), 21, 4)
      .fill({ color: windScale > 0 ? 0xdb6f6f : 0x7085db });
    this.windScroller.x = boxX;
    this.windScroller.tileRotation = windScale > 0 ? Math.PI : 0;
    this.windScroller.tint = windScale > 0 ? 0xcc3333 : 0x2649d9;
    this.windScroller.width = 96 * Math.abs(windScale);
    applyGenericBoxStyle(this.gfx)
      .moveTo(this.windX + 100, this.windY)
      .lineTo(this.windX + 100, this.windY + 25)
      .stroke();
  }
}
