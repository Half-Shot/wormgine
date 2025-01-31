import {
  Point,
  Sprite,
  UPDATE_PRIORITY,
  Text,
  DEG_TO_RAD,
  Graphics,
  TilingSprite,
} from "pixi.js";
import { PhysicsEntity } from "../phys/physicsEntity";
import { GameWorld, RapierPhysicsObject } from "../../world";
import { magnitude, MetersValue, mult, sub } from "../../utils";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { IPhysicalEntity, OnDamageOpts } from "../entity";
import { teamGroupToColorSet, WormInstance } from "../../logic/teams";
import { applyGenericBoxStyle, DefaultTextStyle } from "../../mixins/styles";
import { Viewport } from "pixi-viewport";
import { handleDamageInRadius } from "../../utils/damage";
import { RecordedEntityState } from "../../state/model";
import { HEALTH_CHANGE_TENSION_TIMER } from "../../consts";
import { first, skip, Subscription } from "rxjs";
import Logger from "../../log";

interface Opts {
  explosionRadius: MetersValue;
  damageMultiplier: number;
}

// This is clearly not milliseconds, something is odd about our dt.
const SELF_EXPLODE_MAX_DAMAGE = 25;

export interface PlayableRecordedState extends RecordedEntityState {
  wormIdent: string;
}

const log = new Logger("Playable");

/**
 * Entity that can be directly controlled by a player.
 */
export abstract class PlayableEntity<
  T extends PlayableRecordedState = PlayableRecordedState,
> extends PhysicsEntity<T> {
  priority = UPDATE_PRIORITY.LOW;

  private nameText: Text;
  private healthText: Text;
  protected healthTextBox: Graphics;

  private visibleHealth: number;
  private healthTarget: number;
  private healthChangeTensionTimer: number | null = null;

  get position() {
    return this.physObject.body.translation();
  }

  private readonly healthSub: Subscription;

  constructor(
    sprite: Sprite | TilingSprite,
    body: RapierPhysicsObject,
    world: GameWorld,
    protected parent: Viewport,
    public readonly wormIdent: WormInstance,
    private readonly opts: Opts,
  ) {
    super(sprite, body, world);
    this.renderOffset = new Point(4, 1);
    const { fg } = teamGroupToColorSet(wormIdent.team.group);
    this.nameText = new Text({
      text: this.wormIdent.name,
      style: {
        ...DefaultTextStyle,
        fill: fg,
        align: "center",
      },
    });
    this.visibleHealth = -1;
    this.healthTarget = -1;
    this.healthText = new Text({
      text: this.visibleHealth,
      style: {
        ...DefaultTextStyle,
        fill: fg,
        align: "center",
      },
    });

    this.wormIdent.health$.pipe(first()).subscribe((h) => {
      this.healthTarget = h;
      this.visibleHealth = h;
      this.healthText.text = h;
    });

    this.healthSub = this.wormIdent.health$.pipe(skip(1)).subscribe((h) => {
      this.healthTarget = h;
      // TODO: Potentially further delay until the player has stopped moving.
      this.healthChangeTensionTimer = HEALTH_CHANGE_TENSION_TIMER;
    });

    this.nameText.position.set(0, -5);
    this.healthTextBox = new Graphics();
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

    this.healthTextBox.addChild(this.healthText, this.nameText);
  }

  public setHealthTextPosition() {
    const healthTextXY = [-this.healthText.width / 2, this.nameText.height + 4];
    this.healthText.position.set(healthTextXY[0] + 4, healthTextXY[1] - 4);
  }

  public update(dt: number, dMs: number): void {
    super.update(dt, dMs);
    if (this.destroyed) {
      // TODO: Feels totally unnessacery.
      return;
    }
    if (!this.healthTextBox.destroyed) {
      // Nice and simple parenting
      this.healthTextBox.rotation = 0;
      this.healthTextBox.position.set(
        this.sprite.x - this.sprite.width / 4,
        this.sprite.y - 85,
      );
    }

    if (this.healthChangeTensionTimer) {
      this.wireframe.setDebugText(`tension: ${this.healthChangeTensionTimer}`);
    }

    // TODO: Settling code.
    // if (!this.physObject.body.isMoving() && this.wasMoving) {
    //     this.wasMoving = false;
    //     this.physObject.body.setRotation(0, false);
    //     this.physObject.body.setTranslation(add(this.physObject.body.translation(), new Vector2(0, -0.25)), false);

    // }

    // Complex logic ahead, welcome to the health box tension timer!
    // Whenever the entity takes damage, `healthChangeTensionTimer` is set to a unit of time before
    // we can render the damage to the player.

    // Only decrease the timer when we have come to a standstill.
    if (!this.gameWorld.areEntitiesMoving() && this.healthChangeTensionTimer) {
      this.healthChangeTensionTimer -= dt;
    }

    // If the timer has run out, set to null to indiciate it has expired.
    if (this.healthChangeTensionTimer && this.healthChangeTensionTimer <= 0) {
      if (this.visibleHealth === 0 && !this.isSinking) {
        this.explode();
        return;
      }
      this.healthChangeTensionTimer = null;
    }

    // If the timer is null, decrease the rendered health if nessacery.
    if (this.healthChangeTensionTimer === null) {
      if (this.visibleHealth > this.healthTarget) {
        this.onHealthTensionTimerExpired(true);
        this.visibleHealth--;
        this.healthText.text = this.visibleHealth;
        this.setHealthTextPosition();
        if (this.visibleHealth <= this.healthTarget) {
          this.onHealthTensionTimerExpired(false);
        }
      }

      // If we are dead, set a new timer to decrease to explode after a small delay.
      if (this.visibleHealth === 0) {
        this.healthChangeTensionTimer = HEALTH_CHANGE_TENSION_TIMER;
      }
    }
  }

  protected onHealthTensionTimerExpired(_decreasing: boolean) {
    return;
  }

  public explode() {
    const point = this.physObject.body.translation();
    handleDamageInRadius(
      this.gameWorld,
      this.parent,
      point,
      this.opts.explosionRadius,
      { maxDamage: SELF_EXPLODE_MAX_DAMAGE },
    );
    this.destroy();
  }

  public onCollision(
    otherEnt: IPhysicalEntity,
    contactPoint: Vector2,
  ): boolean {
    if (super.onCollision(otherEnt, contactPoint)) {
      if (this.isSinking) {
        this.wormIdent.setHealth(0);
        this.healthTextBox.destroy();
        this.physObject.body.setRotation(DEG_TO_RAD * 180, false);
      }
      return true;
    }
    return false;
  }

  public onDamage(
    point: Vector2,
    radius: MetersValue,
    opts: OnDamageOpts,
  ): void {
    const maxDamage = opts.maxDamage ?? 50;
    // TODO: Animate damage taken.
    const bodyTranslation = this.physObject.body.translation();
    const distance = Math.max(
      1,
      Math.abs(magnitude(sub(point, this.physObject.body.translation()))),
    );
    const damage = maxDamage / distance;
    this.wormIdent.setHealth(this.wormIdent.health - damage);
    const forceMag = Math.abs((radius.value * 10) / (1 / distance));
    const massagedY = point.y + 5;
    const force = mult(
      {x: point.x > bodyTranslation.x ? -1.5 : 1.5, y: massagedY - bodyTranslation.y ? -1 : 1 },
      {x: forceMag, y: forceMag}
    )
    log.info("onDamage force", "=>", force);
    this.physObject.body.applyImpulse(force, true);
  }

  public recordState() {
    return {
      ...super.recordState(),
      wormIdent: this.wormIdent.uuid,
    };
  }

  public destroy(): void {
    this.healthSub.unsubscribe();
    super.destroy();
    if (!this.healthTextBox.destroyed) {
      this.healthTextBox.destroy();
    }
  }
}
