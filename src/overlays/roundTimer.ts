import { ColorSource, Container, Graphics, Text } from "pixi.js";
import { applyGenericBoxStyle, LargeTextStyle } from "../mixins/styles";
import { Observable } from "rxjs";

/**
 * Displays a round timer duing gameplay.
 */
export class RoundTimer {
  private readonly gfx: Graphics;
  public readonly container: Container;

  constructor(
    private readonly position: Observable<{x: number, y: number}>,
    private readonly roundTimeRemaining: Observable<number>,
    private readonly currentTeamColors: Observable<
      { bg: ColorSource; fg: ColorSource } | undefined
    >,
  ) {
    this.gfx = new Graphics({});
    const text = new Text({
      text: "00",
      style: {
        ...LargeTextStyle,
        align: "center",
      },
    });
    this.container = new Container();
    this.container.addChild(this.gfx);
    this.container.addChild(text);

    this.roundTimeRemaining.subscribe((timeSeconds) => {
      text.text = timeSeconds === 0 ? "--" : timeSeconds;
    });

    this.currentTeamColors.subscribe((color) => {
      this.gfx.clear();
      // Round timer
      applyGenericBoxStyle(this.gfx, color?.fg)
        .roundRect(-8, 8, text.width + 16, text.height, 4)
        .stroke()
        .fill();
    });

    this.position.subscribe((pos) => {
      this.container.position.set(pos.x, pos.y);
    })
  }
}
