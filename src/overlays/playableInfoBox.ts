import { teamGroupToColorSet, WormInstance } from "../logic";
import { Container, Graphics, Text, ViewContainer } from "pixi.js";
import { applyGenericBoxStyle, DefaultTextStyle } from "../mixins/styles";
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  distinct,
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

const DAMAGE_BOX_LIFETIME_MS = 1500;
const DAMAGE_BOX_ANIMATION_PAUSE_MS = 750;

export class PlayableInfoBox {
  public readonly container: Container;
  private readonly nameText: Text;
  private readonly healthText: Text;
  private readonly healthTextBox: Graphics;

  private readonly damageText: Text;
  private readonly damageTextBox: Graphics;
  public readonly damageBox: Container;
  private readonly healthChange = new BehaviorSubject<number>(0);
  private damageLifetimeMs = 0;

  private visibleHealth: number;
  private healthTarget: number;
  private readonly subs: Subscription[] = [];
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
    this.healthText = new Text({
      text: this.visibleHealth,
      style: {
        ...DefaultTextStyle,
        fill: fg,
        align: "center",
      },
    });
    this.damageText = new Text({
      text: "beep",
      style: {
        ...DefaultTextStyle,
        fill: fg,
        align: "center",
      },
    });
    this.container = new Container();
    this.damageBox = new Container({
      position: { x: 0, y: -30 },
      visible: false,
    });
    this.healthTextBox = new Graphics();
    this.damageTextBox = new Graphics();
    this.damageBox.addChild(this.damageTextBox, this.damageText);

    const obs = combineLatest([entitiesMoving, this.wormIdent.health$]).pipe(
      skip(1),
      debounceTime(HEALTH_CHANGE_TENSION_TIMER_MS),
      filter(([moving]) => moving === false),
      map(([_moving, health]) => health),
      distinct(),
      share(),
    );

    this.subs.push(
      obs.subscribe((health) => {
        log.info("Updating health target", health);
        this.healthTarget = health;
        this.healthChange.next(health - this.visibleHealth);
      }),
    );

    this.$onBeginChanged = obs;
    this.nameText.position.set(0, 15);
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

    // Show damage.
    this.subs.push(
      this.healthChange.subscribe((value) => {
        if (value === 0) {
          return;
        }
        this.damageLifetimeMs = DAMAGE_BOX_LIFETIME_MS;
        this.damageTextBox.clear();
        this.damageBox.visible = true;
        this.damageText.text = value;
        const healthTextXY = [
          -this.healthText.width / 2,
          this.nameText.height - 28,
        ];
        this.damageText.position.set(healthTextXY[0] + 4, healthTextXY[1] - 4);

        applyGenericBoxStyle(this.damageTextBox)
          .roundRect(
            healthTextXY[0],
            healthTextXY[1],
            this.damageText.width + 10,
            this.damageText.height - 2,
            4,
          )
          .stroke()
          .fill();
      }),
    );

    // And then hide it.
    this.subs.push(
      this.$onChanged
        .pipe(debounceTime(HEALTH_CHANGE_TENSION_TIMER_MS))
        .subscribe(() => {
          this.damageBox.visible = false;
        }),
    );

    this.nameText.position.set(nameTextXY[0] + 4, nameTextXY[1] - 4);
    this.setHealthTextPosition();
    this.container.addChild(
      this.healthTextBox,
      this.healthText,
      this.nameText,
      this.damageBox,
    );
  }

  setHealthTextPosition() {
    const healthTextXY = [-this.healthText.width / 2, this.nameText.height + 4];
    this.healthText.position.set(healthTextXY[0] + 4, healthTextXY[1] - 4);
  }

  public update(parent: ViewContainer, dMs: number) {
    if (this.container.destroyed) {
      return;
    }
    if (this.damageLifetimeMs > 0) {
      this.damageLifetimeMs -= dMs;
      if (this.damageLifetimeMs > DAMAGE_BOX_ANIMATION_PAUSE_MS) {
        this.damageBox.position.y -= 0.05 * dMs;
      }
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
    if (this.container.destroyed) {
      return;
    }
    this.subs.forEach((s) => s.unsubscribe());
    this.container.destroy();
  }
}
