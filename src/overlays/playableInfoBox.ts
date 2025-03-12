import { teamGroupToColorSet, WormInstance } from "../logic";
import { Container, Graphics, Sprite, Text, TilingSprite, ViewContainer } from "pixi.js";
import { applyGenericBoxStyle, DefaultTextStyle } from "../mixins/styles";
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  filter,
  map,
  Observable,
  share,
  skip,
  Subscription,
} from "rxjs";
import { HEALTH_CHANGE_TENSION_TIMER_MS } from "../consts";
import Logger from "../log";
import { TiledSpriteAnimated } from "../utils/tiledspriteanimated";

const log = new Logger("WormInfoBox");

export class PlayableInfoBox {
  public readonly container: Container;
  private readonly nameText: Text;
  private readonly healthText: Text;
  private readonly healthTextBox: Graphics;

  private visibleHealth: number;
  private healthTarget: number;

  private readonly sub: Subscription;
  private readonly onChanged = new BehaviorSubject<number>(0);
  public readonly $onChanged: Observable<number> = this.onChanged.pipe(skip(1));
  public readonly $onBeginChanged: Observable<number>;

  constructor(
    private readonly wormIdent: WormInstance,
    entitiesMoving: Observable<boolean>,
  ) {
    const { fg } = teamGroupToColorSet(wormIdent.team.group);
    this.visibleHealth = this.wormIdent.health;
    this.healthTarget = this.wormIdent.health;
    this.nameText = new Text({
      text: this.wormIdent.name,
      style: {
        ...DefaultTextStyle,
        fill: fg,
        align: "center",
      },
    });
    this.healthText = new Text({
      text: this.visibleHealth,
      style: {
        ...DefaultTextStyle,
        fill: fg,
        align: "center",
      },
    });
    this.container = new Container();
    this.healthTextBox = new Graphics();

    const obs = combineLatest([entitiesMoving, this.wormIdent.health$]).pipe(
      skip(1),
      debounceTime(HEALTH_CHANGE_TENSION_TIMER_MS),
      filter(([moving]) => moving === false),
      map(([_moving, health]) => health),
      share(),
    );

    this.sub = obs.subscribe((health) => {
      log.info("Updating health target");
      this.healthTarget = health;
    });

    this.$onBeginChanged = obs;

    this.nameText.position.set(0, -5);
    const nameTextXY = [-this.nameText.width / 2, 0];
    const healthTextXY = [-this.healthText.width / 2, this.nameText.height + 4];
    applyGenericBoxStyle(this.healthTextBox)
      .roundRect(
        nameTextXY[0],
        nameTextXY[1],
        this.nameText.width + 10,
        this.nameText.height - 2,
        4,
      )
      .stroke()
      .fill()
      .roundRect(
        healthTextXY[0],
        healthTextXY[1],
        this.healthText.width + 10,
        this.healthText.height - 4,
        4,
      )
      .stroke()
      .fill();

    this.nameText.position.set(nameTextXY[0] + 4, nameTextXY[1] - 4);
    this.setHealthTextPosition();
    this.container.addChild(this.healthTextBox, this.healthText, this.nameText);
  }

  setHealthTextPosition() {
    const healthTextXY = [-this.healthText.width / 2, this.nameText.height + 4];
    this.healthText.position.set(healthTextXY[0] + 4, healthTextXY[1] - 4);
  }

  public update(parent: ViewContainer) {
    if (this.container.destroyed) {
      return;
    }
    // Nice and simple parenting
    this.container.rotation = 0;
    if (parent instanceof TiledSpriteAnimated) {
      this.container.position.set(
        parent.x - parent.scaledWidth / 4,
        parent.y - 85,
      );
    } else {
      this.container.position.set(parent.x - parent.width / 4, parent.y - 85);
    }

    // If the timer is null, decrease the rendered health if nessacery.
    if (this.visibleHealth > this.healthTarget) {
      this.visibleHealth--;
      this.healthText.text = this.visibleHealth;
      this.setHealthTextPosition();
      if (this.visibleHealth <= this.healthTarget) {
        this.onChanged.next(this.visibleHealth);
      }
    }
  }

  public destroy() {
    this.sub.unsubscribe();
    this.container.destroy();
  }
}
