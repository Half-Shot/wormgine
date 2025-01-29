import { ColorSource, Graphics, Container, Ticker, Text } from "pixi.js";
import { DefaultTextStyle, applyGenericBoxStyle } from "../mixins/styles";
import { Observable } from "rxjs";

interface Toast {
  text: string;
  timer: number;
  color: ColorSource;
  interruptable: boolean;
}

/**
 * Displays toast at the top of the screen during gameplay.
 */
export class Toaster {
  private readonly gfx: Graphics;
  private toastTime = 0;
  private currentToastIsInterruptable = true;
  private toaster: Toast[] = [];
  private readonly text: Text;
  public readonly container: Container;

  constructor(
      screenSize: Observable<{width: number, height: number}>,
  ) {
    this.container = new Container();
    this.gfx = new Graphics();
    this.text = new Text({
      text: "",
      style: {
        ...DefaultTextStyle,
        fontSize: 48,
        align: "center",
      },
    });
    this.text.anchor.set(0.5, 0.5);
    this.container.addChild(this.gfx, this.text);
    screenSize.subscribe((size) => {
      const topY = size.height / 20;
      this.container.position.set(size.width / 2, topY);
    })
  }

  public update(dt: Ticker) {
    const shouldInterrupt =
      this.currentToastIsInterruptable && this.toaster.length;

    if (!this.text.text || shouldInterrupt) {
      const newToast = this.toaster.pop();
      if (newToast) {
        this.gfx.clear();
        this.text.text = newToast.text;
        this.text.style.fill = newToast.color;
        this.toastTime = newToast.timer;
        this.currentToastIsInterruptable = newToast.interruptable;
        const totalWidth = this.text.width + 6;
        applyGenericBoxStyle(this.gfx)
          .roundRect(-(totalWidth/2) - 3, -12, totalWidth+6, this.text.height-4, 4)
          .stroke()
          .fill();
      }
    }

    if (this.text.text) {
      // Render toast
      this.toastTime -= dt.deltaMS;
      this.container.alpha = Math.min(1, this.toastTime / 100);
      if (this.toastTime <= 0) {
        this.text.text = "";
        this.toastTime = 0;
        this.gfx.clear();
      }
    }
  }

  /**
   * Adds some text to be displayed at the top of the screen.
   * @param text The text notice.
   * @param timer How long should the notice be displayed.
   * @param color The colour of the text.
   * @param interruptable Should the toast be interrupted by the next notice?
   */
  public pushToast(
    text: string,
    timer = 5000,
    color: ColorSource = "#FFFFFF",
    interruptable = false,
  ) {
    this.toaster.splice(0, 0, { text, timer, color, interruptable });
  }
}
