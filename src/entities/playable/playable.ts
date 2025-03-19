import {
  Point,
  Sprite,
  UPDATE_PRIORITY,
  DEG_TO_RAD,
  ViewContainer,
} from "pixi.js";
import { PhysicsEntity } from "../phys/physicsEntity";
import { GameWorld, RapierPhysicsObject } from "../../world";
import { magnitude, MetersValue, mult, sub } from "../../utils";
import { Vector2 } from "@dimforge/rapier2d-compat";
import { IPhysicalEntity, OnDamageOpts } from "../entity";
import { teamGroupToColorSet, WormInstance } from "../../logic";
import { Viewport } from "pixi-viewport";
import { handleDamageInRadius } from "../../utils/damage";
import { RecordedEntityState } from "../../state/model";
import { HEALTH_CHANGE_TENSION_TIMER_MS } from "../../consts";
import Logger from "../../log";
import {
  getConditionEffect,
  getConditionTint,
  PlayableCondition,
} from "./conditions";
import { PlayableInfoBox } from "../../overlays/playableInfoBox";

interface Opts {
  explosionRadius: MetersValue;
  damageMultiplier: number;
}

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
  S extends ViewContainer = Sprite,
> extends PhysicsEntity<T, S> {
  priority = UPDATE_PRIORITY.LOW;

  private explodeTimer: number | null = null;

  /**
   * Conditions turns remaining. -1 for never expiring.
   */
  protected readonly conditions = new Map<PlayableCondition, number>();
  protected readonly infoBox: PlayableInfoBox;

  get position() {
    return this.physObject.body.translation();
  }

  constructor(
    sprite: S,
    body: RapierPhysicsObject,
    world: GameWorld,
    protected parent: Viewport,
    public readonly wormIdent: WormInstance,
    private readonly opts: Opts,
  ) {
    super(sprite, body, world);
    this.renderOffset = new Point(4, 1);
    this.infoBox = new PlayableInfoBox(wormIdent, world.entitiesMoving$);
    this.infoBox.$onChanged.subscribe((visibleHealth) => {
      if (visibleHealth === 0) {
        log.info("Set explode timer");
        this.explodeTimer = HEALTH_CHANGE_TENSION_TIMER_MS;
      }
    });
  }

  public update(dt: number, dMs: number): void {
    super.update(dt, dMs);
    if (this.destroyed) {
      log.debug("FIXME Ran update for a destroyed entity");
      // TODO: Feels totally unnessacery.
      return;
    }
    if (this.isSinking) {
      return;
    }
    this.infoBox.update(this.sprite);

    // TODO: Settling code.
    // if (!this.physObject.body.isMoving() && this.wasMoving) {
    //     this.wasMoving = false;
    //     this.physObject.body.setRotation(0, false);
    //     this.physObject.body.setTranslation(add(this.physObject.body.translation(), new Vector2(0, -0.25)), false);

    // }

    // Complex logic ahead, welcome to the health box tension timer!
    // Whenever the entity takes damage, `healthChangeTensionTimer` is set to a unit of time before
    // we can render the damage to the player.

    // If the timer has run out, set to null to indiciate it has expired.
    // XXX: Should the visible health setting control this?
    if (this.explodeTimer !== null) {
      log.info("Explode timer called");
      if (this.explodeTimer <= 0) {
        this.explode();
      } else {
        this.explodeTimer -= dMs;
      }
      return;
    }
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
      return true;
    }
    return false;
  }

  public reduceHealth(damage: number) {
    const damageMultiplier = this.conditions
      .keys()
      .map((v) => getConditionEffect(v).damageMultiplier)
      .reduce<number>((v, c) => {
        if (c === undefined) {
          return v;
        }
        if (v === undefined) {
          return c;
        }
        return Math.min(v, c);
      }, 1);
    this.wormIdent.setHealth(this.wormIdent.health - damage * damageMultiplier);
  }

  public roundTick() {
    const { takeDamagePerRound, cannotDieFromDamage } = this.conditions
      .keys()
      .map((v) => {
        const condtion = getConditionEffect(v);
        return {
          takeDamagePerRound: condtion.takeDamagePerRound ?? 0,
          cannotDieFromDamage: condtion.cannotDieFromDamage ?? false,
        };
      })
      .reduce(
        (v, c) => {
          if (c === undefined) {
            return v;
          }
          if (v === undefined) {
            return c;
          }
          return {
            cannotDieFromDamage: v.cannotDieFromDamage || c.cannotDieFromDamage,
            takeDamagePerRound: v.takeDamagePerRound + c.takeDamagePerRound,
          };
        },
        { takeDamagePerRound: 0, cannotDieFromDamage: false },
      );
    if (takeDamagePerRound) {
      if (cannotDieFromDamage && this.wormIdent.health > takeDamagePerRound) {
        this.reduceHealth(takeDamagePerRound);
      }
    }
  }

  public addCondition(condition: PlayableCondition, turns = -1) {
    this.conditions.set(condition, turns);
    const teamColor = teamGroupToColorSet(this.wormIdent.team.group).fg;
    this.sprite.tint = getConditionTint(this.conditions.keys()) ?? teamColor;
  }

  public removeCondition(condition: PlayableCondition) {
    if (this.conditions.delete(condition)) {
      const teamColor = teamGroupToColorSet(this.wormIdent.team.group).fg;
      this.sprite.tint = getConditionTint(this.conditions.keys()) ?? teamColor;
    }
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
    this.reduceHealth(damage);
    const forceMultiplier = this.conditions
      .keys()
      .map((v) => getConditionEffect(v).forceMultiplier)
      .reduce<number>((v, c) => {
        if (c === undefined) {
          return v;
        }
        if (v === undefined) {
          return c;
        }
        return Math.min(v, c);
      }, 1);
    const forceMag =
      Math.abs((radius.value * 10) / (1 / distance)) *
      forceMultiplier *
      (opts.forceMultiplier ?? 1);
    const massagedY = point.y + 5;
    const force = mult(
      {
        x: point.x > bodyTranslation.x ? -1.5 : 1.5,
        y: massagedY - bodyTranslation.y ? -1 : 1,
      },
      { x: forceMag, y: forceMag },
    );
    log.info("onDamage force", "=>", force);
    this.physObject.body.applyImpulse(force, true);
    if (opts.applyCondition) {
      this.addCondition(opts.applyCondition);
    }
  }

  public recordState() {
    return {
      ...super.recordState(),
      wormIdent: this.wormIdent.uuid,
    };
  }

  public destroy(): void {
    super.destroy();
    this.infoBox.destroy();
  }

  protected sink(): void {
    super.sink();
    this.wormIdent.setHealth(0);
  }
}
