import { Graphics, Point, Sprite, Texture } from "pixi.js";
import {
  FireOpts,
  IWeaponCode,
  IWeaponDefiniton as IWeaponDefinition,
} from "../../weapons/weapon";
import Controller, { InputKind } from "../../input";
import {
  collisionGroupBitmask,
  CollisionGroups,
  GameWorld,
  PIXELS_PER_METER,
} from "../../world";
import {
  ActiveEvents,
  ColliderDesc,
  Cuboid,
  RigidBodyDesc,
  Vector2,
} from "@dimforge/rapier2d-compat";
import { Coordinate, MetersValue } from "../../utils/coodinate";
import { AssetPack } from "../../assets";
import { PlayableEntity, PlayableRecordedState } from "./playable";
import { teamGroupToColorSet, WormInstance } from "../../logic";
import { calculateMovement } from "../../movementController";
import { Viewport } from "pixi-viewport";
import { magnitude, pointOnRadius, sub } from "../../utils";
import { Toaster } from "../../overlays/toaster";
import {
  EndTurnFallDamage,
  EndTurnTimerElapsed,
  EndTurnTookDamange,
  templateRandomText,
  TurnStartText,
  WeaponTimerText,
  WormDeathGeneric,
  WormDeathSinking,
} from "../../text/toasts";
import { WeaponBazooka } from "../../weapons";
import { EntityType } from "../type";
import { StateRecorder } from "../../state/recorder";
import { StateWormAction } from "../../state/model";
import { CameraLockPriority } from "../../camera";
import { OnDamageOpts } from "../entity";
import Logger from "../../log";
import { WormState, InnerWormState } from "./wormState";
import { BehaviorSubject, combineLatest, filter, first, timer } from "rxjs";
import { TweenEngine } from "../../motion/tween";
import { TiledSpriteAnimated } from "../../utils/tiledspriteanimated";
import { getConditionTint } from "./conditions";
import { POPUP_DELAY_MS } from "../../consts";

export enum EndTurnReason {
  TimerElapsed = 0,
  FallDamage = 1,
  FiredWeapon = 2,
  Sank = 3,
  TookDamage = 4,
}

const MaxAim = Math.PI * 1.5; // Up
const MinAim = Math.PI * 0.5; // Down
const targettingRadius = new MetersValue(5);
const FireAngleArcPadding = 0.15;
const maxWormStep = new MetersValue(0.6);
const aimMoveSpeed = 0.02;
const logger = new Logger("Worm");

export type FireFn = (
  worm: Worm,
  selectedWeapon: IWeaponDefinition,
  opts: FireOpts,
) => void;

interface PerRoundState {
  shotsTaken: number;
  weaponTarget?: Coordinate;
  hasPerformedAction: boolean;
}

const DEFAULT_PER_ROUND_STATE: PerRoundState = {
  shotsTaken: 0,
  hasPerformedAction: false,
};

export interface WormRecordedState extends PlayableRecordedState {
  weapon: IWeaponCode;
  facingRight: boolean;
}

const FRICTION_WHEN_ACTIVE = 0.075;
const FRICTION_WHEN_IDLE = 0.125;
const RESITITION_WHEN_IDLE = 0.35;
const RESITITION_WHEN_ACTIVE = 0.15;

/**
 * Physical representation of a worm on the map. May be controlled.
 */
export class Worm extends PlayableEntity<
  WormRecordedState,
  TiledSpriteAnimated
> {
  private static readonly collisionBitmask = collisionGroupBitmask(
    [CollisionGroups.WorldObjects],
    [CollisionGroups.Terrain, CollisionGroups.WorldObjects],
  );
  protected static readonly movementSpeed: Vector2 = {
    x: 0.005,
    y: 0.1,
  };

  public static readAssets(assets: AssetPack) {
    Worm.idleAnim = assets.textures.player_koboldIdle;
    Worm.springArrow = assets.textures.spring;
  }

  // TODO: Best place for this var?
  private arrowSprite: TiledSpriteAnimated;
  private currentWeapon: IWeaponDefinition = WeaponBazooka;
  private impactVelocity = 0;
  private perRoundState = new BehaviorSubject<PerRoundState>({
    ...DEFAULT_PER_ROUND_STATE,
  });
  private static idleAnim: Texture;
  private static impactDamageMultiplier = 0.75;
  private static minImpactForDamage = 12;
  private static springArrow: Texture;
  private turnEndedReason: EndTurnReason | undefined;
  private weaponSprite: Sprite;
  private weaponTimerSecs = 3;
  protected facingRight = true;
  protected fireWeaponDuration = 0;
  protected motionTween?: TweenEngine;
  protected state = new WormState(InnerWormState.Inactive);
  protected targettingGfx: Graphics;
  public fireAngle = 0;

  get itemPlacementPosition() {
    const trans = this.body.translation();
    const width = (this.body.collider(0).shape as Cuboid).halfExtents.x;
    if (this.facingRight) {
      return new Coordinate(trans.x + width + 2, trans.y);
    }
    return new Coordinate(trans.x - (width + 0.33), trans.y);
  }

  get perRoundState$() {
    return this.perRoundState.asObservable();
  }

  static create(
    parent: Viewport,
    world: GameWorld,
    position: Coordinate,
    wormIdent: WormInstance,
    onFireWeapon: FireFn,
    toaster?: Toaster,
    recorder?: StateRecorder,
  ) {
    const ent = new Worm(
      position,
      world,
      parent,
      wormIdent,
      onFireWeapon,
      toaster,
      recorder,
    );
    world.addBody(ent, ent.physObject.collider);
    parent.addChild(ent.targettingGfx);
    parent.addChild(ent.sprite);
    parent.addChild(ent.wireframe.renderable);
    parent.addChild(ent.infoBox.container);
    parent.addChild(ent.weaponSprite);
    parent.addChild(ent.arrowSprite);
    return ent;
  }

  get position() {
    return this.physObject.body.translation();
  }

  get currentState() {
    return this.state;
  }

  get collider() {
    return this.physObject.collider;
  }

  get weapon() {
    return this.currentWeapon;
  }

  protected constructor(
    position: Coordinate,
    world: GameWorld,
    parent: Viewport,
    wormIdent: WormInstance,
    private readonly onFireWeapon: FireFn,
    private readonly toaster?: Toaster,
    private readonly recorder?: StateRecorder,
  ) {
    const sprite = new TiledSpriteAnimated({
      texture: Worm.idleAnim,
      width: 104,
      height: 148,
      tileScale: { x: 1, y: 1 },
      tilePosition: { x: 0, y: 0 },
      scale: { x: 0.33, y: 0.33 },
      anchor: { x: 0.5, y: 0.5 },
      columns: 10,
      tileCount: 120,
      fps: 60,
      randomizeStartFrame: true,
    });
    const teamColor = teamGroupToColorSet(wormIdent.team.group).fg;
    const body = world.createRigidBodyCollider(
      ColliderDesc.cuboid(
        sprite.scaledWidth / (PIXELS_PER_METER * 2),
        sprite.scaledHeight / (PIXELS_PER_METER * 2),
      )
        .setActiveEvents(ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(Worm.collisionBitmask)
        .setSolverGroups(Worm.collisionBitmask)
        .setFriction(FRICTION_WHEN_IDLE)
        .setRestitution(RESITITION_WHEN_IDLE),
      RigidBodyDesc.dynamic()
        .setTranslation(position.worldX, position.worldY)
        .lockRotations(),
    );
    super(sprite, body, world, parent, wormIdent, {
      explosionRadius: new MetersValue(2.5),
      damageMultiplier: 250,
    });
    this.infoBox.$onBeginChanged.subscribe((visibleHealth) => {
      this.desiredCameraLockPriority.next(
        visibleHealth === 0
          ? CameraLockPriority.LockIfNotLocalPlayer
          : CameraLockPriority.NoLock,
      );
    });
    this.sprite.tint = getConditionTint(this.conditions.keys()) ?? teamColor;
    // To give the worm a look of appearing on the ground.
    this.renderOffset = new Point(0, 4);
    this.weaponSprite = new Sprite({
      texture: this.currentWeapon.sprite?.texture,
    });
    this.targettingGfx = new Graphics({ visible: false });
    this.updateTargettingGfx();
    this.wormIdent.health$
      .pipe(
        filter((v) => v === 0),
        first(),
      )
      .subscribe(() => {
        // Generic death
        this.toaster?.pushToast(
          templateRandomText(WormDeathGeneric, {
            WormName: this.wormIdent.name,
            TeamName: this.wormIdent.team.name,
          }),
          POPUP_DELAY_MS,
        );
      });
    this.arrowSprite = new TiledSpriteAnimated({
      visible: false,
      texture: Worm.springArrow,
      width: 138,
      height: 180,
      tileScale: { x: 1, y: 1 },
      tilePosition: { x: 0, y: 0 },
      scale: { x: 0.33, y: 0.33 },
      anchor: { x: 0.5, y: 0.5 },
      columns: 10,
      tileCount: 60,
      fps: 60,
      tint: teamColor,
    });
  }

  public selectWeapon(weapon: IWeaponDefinition) {
    if (this.perRoundState.value.shotsTaken > 0) {
      // Worm is already in progress of shooting things.
      return;
    }
    this.currentWeapon = weapon;
    this.toaster?.pushToast(weapon.name, undefined, undefined, true);
    if (weapon.sprite?.texture) {
      this.weaponSprite.texture = weapon.sprite.texture;
      this.weaponSprite.scale = weapon.sprite.scale ?? { x: 1, y: 1 };
    }
  }

  onWormSelected(bindInput = true) {
    logger.info("Selected worm", this.toString());
    // Tick down any conditions with timers.
    for (const [condition, turns] of this.conditions.entries()) {
      if (turns === -1) {
        return;
      }
      if (turns === 1) {
        this.removeCondition(condition);
      } else {
        this.conditions.set(condition, turns - 1);
      }
    }

    this.toaster?.pushToast(
      templateRandomText(TurnStartText, {
        WormName: this.wormIdent.name,
        TeamName: this.wormIdent.team.name,
      }),
      POPUP_DELAY_MS,
      teamGroupToColorSet(this.wormIdent.team.group).fg,
      true,
    );
    this.safeUsePhys(({ collider }) => {
      collider.setFriction(FRICTION_WHEN_ACTIVE);
      collider.setRestitution(RESITITION_WHEN_ACTIVE);
    });
    this.state.transition(InnerWormState.Idle);
    this.desiredCameraLockPriority.next(CameraLockPriority.AlwaysLock);
    this.perRoundState.next({ ...DEFAULT_PER_ROUND_STATE });
    if (bindInput) {
      Controller.on("inputBegin", this.onInputBegin);
      Controller.on("inputEnd", this.onInputEnd);
    }
    // If the current weapon has no ammo, switch to the first available.
    const weps = new Map(this.wormIdent.team.availableWeapons);
    if (!weps.has(this.currentWeapon)) {
      this.currentWeapon = [...weps.keys()][0];
      if (this.currentWeapon === undefined) {
        // We should never allow an inventory with a non-infinite weapon.
        throw Error("No weapons in inventory, worm cannot play");
      }
    }
  }

  onEndOfTurn() {
    let endOfTurnMsg: string[] | null = null;
    switch (this.turnEndedReason) {
      case EndTurnReason.FallDamage:
        endOfTurnMsg = EndTurnFallDamage;
        break;
      case EndTurnReason.TimerElapsed:
        endOfTurnMsg = EndTurnTimerElapsed;
        break;
      case EndTurnReason.TookDamage:
        endOfTurnMsg = EndTurnTookDamange;
        break;
      case EndTurnReason.Sank:
        // Handled in destroy
        break;
      default:
        break;
    }
    if (endOfTurnMsg) {
      this.toaster?.pushToast(
        templateRandomText(endOfTurnMsg, {
          WormName: this.wormIdent.name,
          TeamName: this.wormIdent.team.name,
        }),
        POPUP_DELAY_MS,
      );
    }
    this.safeUsePhys(({ collider }) => {
      collider.setFriction(FRICTION_WHEN_IDLE);
      collider.setFriction(RESITITION_WHEN_IDLE);
    });
    this.state.transition(InnerWormState.Inactive);
    Controller.removeListener("inputBegin", this.onInputBegin);
    Controller.removeListener("inputEnd", this.onInputEnd);
    this.desiredCameraLockPriority.next(CameraLockPriority.NoLock);
    this.targettingGfx.visible = false;
  }

  onJump() {
    if (!this.state.canMove) {
      return;
    }
    this.recorder?.recordWormAction(this.wormIdent.uuid, StateWormAction.Jump);
    this.state.transition(InnerWormState.InMotion);
    this.body.applyImpulse({ x: this.facingRight ? 12 : -12, y: -30 }, true);
  }

  onBackflip() {
    if (!this.state.canMove) {
      return;
    }
    this.state.transition(InnerWormState.InMotion);
    this.recorder?.recordWormAction(
      this.wormIdent.uuid,
      StateWormAction.Backflip,
    );
    this.body.applyImpulse({ x: this.facingRight ? -6 : 6, y: -45 }, true);
  }

  onInputBegin = (
    inputKind: InputKind,
    position?: { x: number; y: number },
  ) => {
    if (!this.state.shouldHandleNewInput) {
      // Ignore all input when the worm is firing.
      return;
    }
    if (this.desiredCameraLockPriority.value === CameraLockPriority.AlwaysLock) {
      // Once the player has moved, reduce down to a suggested lock.
      this.desiredCameraLockPriority.next(CameraLockPriority.SuggestedLockLocal);
    }
    this.perRoundState.next({
      ...this.perRoundState.value,
      hasPerformedAction: true,
    });
    logger.info(
      "Got input",
      inputKind,
      this.state.stateName,
      this.state.canFire,
    );
    if (inputKind === InputKind.MoveLeft || inputKind === InputKind.MoveRight) {
      this.setMoveDirection(inputKind);
    } else if (inputKind === InputKind.Jump) {
      this.onJump();
    } else if (inputKind === InputKind.Backflip) {
      this.onBackflip();
    } else if (!this.state.canFire) {
      return;
    } else if (inputKind === InputKind.AimUp) {
      this.state.transition(InnerWormState.AimingUp);
    } else if (inputKind === InputKind.AimDown) {
      this.state.transition(InnerWormState.AimingDown);
    } else if (inputKind === InputKind.Fire && !this.needsTarget) {
      this.onBeginFireWeapon();
    } else if (
      inputKind === InputKind.PickTarget &&
      position &&
      this.weapon.showTargetPicker
    ) {
      const point = new Point();
      this.parent.options.events.mapPositionToPoint(
        point,
        position.x,
        position.y,
      );
      const screenPoint = this.parent.toWorld(point.x, point.y);
      const newCoodinate = Coordinate.fromScreen(screenPoint.x, screenPoint.y);
      logger.info("Picked target", position, point, newCoodinate);
      this.perRoundState.next({
        ...this.perRoundState.value,
        weaponTarget: newCoodinate,
      });
    }
    if (this.currentWeapon.timerAdjustable) {
      const oldTime = this.weaponTimerSecs;
      switch (inputKind) {
        case InputKind.WeaponTimer1:
          this.weaponTimerSecs = 1;
          break;
        case InputKind.WeaponTimer2:
          this.weaponTimerSecs = 2;
          break;
        case InputKind.WeaponTimer3:
          this.weaponTimerSecs = 3;
          break;
        case InputKind.WeaponTimer4:
          this.weaponTimerSecs = 4;
          break;
        case InputKind.WeaponTimer5:
          this.weaponTimerSecs = 5;
          break;
      }
      if (this.weaponTimerSecs !== oldTime) {
        this.toaster?.pushToast(
          templateRandomText(WeaponTimerText, {
            Time: this.weaponTimerSecs.toString(),
          }),
          1250,
          undefined,
          true,
        );
      }
    }
  };

  onInputEnd = (inputKind: InputKind) => {
    if (inputKind === InputKind.Fire) {
      this.onEndFireWeapon();
    }
    if (!this.state.shouldHandleNewInput) {
      // Ignore all input when the worm is firing.
      return;
    }
    if (inputKind === InputKind.MoveLeft || inputKind === InputKind.MoveRight) {
      this.resetMoveDirection(inputKind);
    }
    if (
      (this.state.state === InnerWormState.AimingUp &&
        inputKind === InputKind.AimUp) ||
      (this.state.state === InnerWormState.AimingDown &&
        inputKind === InputKind.AimDown)
    ) {
      this.recorder?.recordWormAim(
        this.wormIdent.uuid,
        this.state.state === InnerWormState.AimingUp ? "up" : "down",
        this.fireAngle,
      );
      this.state.transition(InnerWormState.Idle);
    }
  };

  setMoveDirection(direction: InputKind.MoveLeft | InputKind.MoveRight) {
    // We can only change direction if we are idle.
    if (!this.state.canMove) {
      logger.info("Can't move!");
      // Falling, can't move
      return;
    }
    const changedDirection =
      (direction === InputKind.MoveLeft && this.facingRight) ||
      (direction === InputKind.MoveRight && !this.facingRight);

    if (changedDirection) {
      this.fireAngle = MaxAim + (MaxAim - this.fireAngle);
      if (this.fireAngle > Math.PI * 2) {
        this.fireAngle -= Math.PI * 2;
      }
      if (this.fireAngle < 0) {
        this.fireAngle = Math.PI * 2 - this.fireAngle;
      }
      this.facingRight = !this.facingRight;
    }

    this.state.transition(
      direction === InputKind.MoveLeft
        ? InnerWormState.MovingLeft
        : InnerWormState.MovingRight,
    );
  }

  resetMoveDirection(
    inputDirection?: InputKind.MoveLeft | InputKind.MoveRight,
  ) {
    // We can only stop moving if we are in control of our movements and the input that
    // completed was the movement key.

    if (this.state.state === InnerWormState.InMotion) {
      this.state.voidStatePriorToMotion();
    }

    if (
      (this.state.state === InnerWormState.MovingLeft &&
        inputDirection === InputKind.MoveLeft) ||
      (this.state.state === InnerWormState.MovingRight &&
        inputDirection === InputKind.MoveRight) ||
      !inputDirection
    ) {
      this.state.transition(this.state.statePriorToMotion);
      return;
    }
  }

  onMove(moveState: InnerWormState.MovingLeft | InnerWormState.MovingRight) {
    const movementMod = 0.33;
    const moveMod = new Vector2(
      moveState === InnerWormState.MovingLeft ? -movementMod : movementMod,
      0,
    );
    const move = calculateMovement(
      this.physObject,
      moveMod,
      maxWormStep,
      this.gameWorld,
    );
    this.motionTween = new TweenEngine(
      this.body,
      Worm.movementSpeed,
      Coordinate.fromWorld(move),
    );
  }

  onBeginFireWeapon() {
    this.state.transition(InnerWormState.Firing);
  }

  public onDamage(
    point: Vector2,
    radius: MetersValue,
    opts: OnDamageOpts,
  ): void {
    this.safeUsePhys(({ collider }) => {
      collider.setFriction(FRICTION_WHEN_ACTIVE);
    });
    super.onDamage(point, radius, opts);
    if (this.state.isPlaying) {
      this.state.transition(InnerWormState.Inactive);
      this.turnEndedReason = EndTurnReason.TookDamage;
    }
  }

  onEndFireWeapon(remoteOpts?: FireOpts) {
    if (!this.state.isFiring) {
      return;
    }
    this.wormIdent.team.consumeAmmo(this.weapon.code);
    const maxShots = this.weapon.shots ?? 1;
    const duration = this.fireWeaponDuration;
    const { weaponTarget, shotsTaken } = this.perRoundState.value;
    const opts = remoteOpts ?? {
      duration,
      timer: this.weaponTimerSecs,
      angle: this.fireAngle,
      target: weaponTarget,
    };
    this.recorder?.recordWormFire(this.wormIdent.uuid, opts);
    this.targettingGfx.visible = false;
    this.perRoundState.next({
      ...this.perRoundState.value,
      shotsTaken: shotsTaken + 1,
    });
    // TODO: Need a middle state for while the world is still active.
    this.desiredCameraLockPriority.next(CameraLockPriority.NoLock);
    this.fireWeaponDuration = 0;

    // Determine worm state based on the kind of weapon
    const hasMoreShots = maxShots > shotsTaken + 1;
    if (hasMoreShots) {
      this.state.transition(InnerWormState.FiringWaitingForNextShot);
      const sub = combineLatest([
        timer(1500),
        this.gameWorld.entitiesMoving$,
      ]).subscribe(([timer, entitiesMoving]) => {
        logger.info("hasMoreShots", timer, entitiesMoving);
        if (timer === 0 && !entitiesMoving) {
          if (this.state.state === InnerWormState.FiringWaitingForNextShot) {
            this.state.transition(InnerWormState.Idle);
            sub.unsubscribe();
          }
        }
      });
    } else if (this.weapon.allowGetaway) {
      this.state.transition(InnerWormState.Getaway);
    } else {
      this.state.transition(InnerWormState.InactiveWaiting);
    }

    this.onFireWeapon(this, this.currentWeapon, opts);
    this.turnEndedReason = EndTurnReason.FiredWeapon;
    this.updateTargettingGfx();
  }

  updateTargettingGfx() {
    this.targettingGfx.clear();
    const teamFgColour = teamGroupToColorSet(this.wormIdent.team.group).fg;
    this.targettingGfx
      .circle(0, 0, 12)
      .stroke({
        color: teamFgColour,
        width: 2,
      })
      .moveTo(-12, 0)
      .lineTo(12, 0)
      .moveTo(0, -12)
      .lineTo(0, 12)
      .stroke({
        color: teamFgColour,
        width: 4,
      })
      .circle(0, 0, 3)
      .fill({
        color: "white",
      });
    if (
      this.state.state === InnerWormState.Firing &&
      this.currentWeapon.maxDuration
    ) {
      const mag = this.fireWeaponDuration / this.currentWeapon.maxDuration;
      const relativeSpritePos = sub(
        this.sprite.position,
        this.targettingGfx.position,
      );
      this.targettingGfx
        .moveTo(relativeSpritePos.x, relativeSpritePos.y)
        .arc(
          relativeSpritePos.x,
          relativeSpritePos.y,
          mag * targettingRadius.pixels,
          this.fireAngle - FireAngleArcPadding,
          this.fireAngle + FireAngleArcPadding,
        )
        .moveTo(relativeSpritePos.x, relativeSpritePos.y)
        .fill({
          color: teamFgColour,
        });
    }
  }

  updateAiming() {
    if (this.state.state === InnerWormState.AimingUp) {
      if (this.facingRight) {
        if (this.fireAngle >= MaxAim || this.fireAngle <= MinAim) {
          this.fireAngle = this.fireAngle - aimMoveSpeed;
        }
      } else {
        if (this.fireAngle <= MaxAim || this.fireAngle >= MinAim) {
          this.fireAngle = this.fireAngle + aimMoveSpeed;
        }
      }
    } else if (this.state.state === InnerWormState.AimingDown) {
      if (this.facingRight) {
        if (this.fireAngle >= MaxAim || this.fireAngle <= MinAim) {
          this.fireAngle = this.fireAngle + aimMoveSpeed; // Math.max(this.fireAngle - aimMoveSpeed, MinAim);
        }
      } else {
        this.fireAngle = this.fireAngle - aimMoveSpeed; //Math.min(this.fireAngle + aimMoveSpeed, MaxAim);
      }
    } // else, we're idle and not currently moving.

    if (this.facingRight) {
      if (
        this.fireAngle < MaxAim &&
        this.fireAngle > MaxAim - aimMoveSpeed * 2
      ) {
        this.fireAngle = MaxAim;
      }
      if (this.fireAngle > MinAim && this.fireAngle < MaxAim) {
        this.fireAngle = MinAim;
      }
    } else {
      if (
        this.fireAngle > MaxAim &&
        this.fireAngle < MaxAim + aimMoveSpeed * 2
      ) {
        this.fireAngle = MaxAim;
      }
      if (this.fireAngle < MinAim && this.fireAngle < MaxAim) {
        this.fireAngle = MinAim;
      }
    }

    if (this.fireAngle > Math.PI * 2) {
      this.fireAngle = 0;
    }
    if (this.fireAngle < 0) {
      this.fireAngle = Math.PI * 2;
    }
  }

  get needsTarget() {
    return (
      !!this.weapon.showTargetPicker && !this.perRoundState.value.weaponTarget
    );
  }

  update(dt: number, dMs: number): void {
    super.update(dt, dMs);
    if (this.sprite.destroyed) {
      return;
    }
    this.sprite.update(dMs);
    if (this.isSinking) {
      return;
    }
    if (this.wireframe.enabled) {
      this.wireframe.setDebugText(
        `worm_state: ${this.state.stateName}, velocity: ${this.body.linvel().y} ${this.impactVelocity}, aim: ${this.fireAngle}, friction: ${this.collider.friction()}, conditions: ${this.conditions.keys().toArray().join(", ")}`,
      );
    }
    this.weaponSprite.visible = this.state.showWeapon;
    this.arrowSprite.visible =
      this.state.canMove && !this.perRoundState.value.hasPerformedAction;
    if (this.arrowSprite.visible) {
      this.arrowSprite.visible = true;
      this.arrowSprite.update(dMs);
      this.arrowSprite.x = this.sprite.x;
      this.arrowSprite.y = this.infoBox.container.y - 25;
    }
    if (!this.state.active && !this.body.isMoving()) {
      this.safeUsePhys(({ collider }) => {
        collider.setFriction(FRICTION_WHEN_IDLE);
      });
    }

    if (!this.state.shouldUpdate) {
      // Do nothing.
      return;
    }

    this.sprite.scale.x = this.facingRight
      ? Math.abs(this.sprite.scale.x)
      : -Math.abs(this.sprite.scale.x);

    const falling = !this.isSinking && this.body.linvel().y > 4;

    this.targettingGfx.visible =
      !this.needsTarget &&
      !!this.currentWeapon.showTargetGuide &&
      this.state.showWeaponTarget;

    if (this.targettingGfx.visible) {
      const { x, y } = pointOnRadius(
        this.sprite.x,
        this.sprite.y,
        this.fireAngle,
        targettingRadius.pixels,
      );
      this.targettingGfx.position.set(x, y);
    }

    if (this.currentWeapon.sprite) {
      if (this.facingRight) {
        this.weaponSprite.position.set(
          this.sprite.x + this.currentWeapon.sprite.offset.x,
          this.sprite.y + this.currentWeapon.sprite.offset.y,
        );
        this.weaponSprite.rotation = this.fireAngle;
        this.weaponSprite.scale.x = this.currentWeapon.sprite.scale.x ?? 1;
      } else {
        this.weaponSprite.position.set(
          this.sprite.x -
            (this.sprite.scaledWidth + this.currentWeapon.sprite.offset.x),
          this.sprite.y + this.currentWeapon.sprite.offset.y,
        );
        this.weaponSprite.rotation = this.fireAngle - Math.PI;
        this.weaponSprite.scale.x = this.currentWeapon.sprite.scale.x * -1;
      }
    } else {
      this.weaponSprite.visible = false;
    }

    if (this.state.isFiring) {
      this.updateTargettingGfx();
    }

    if (this.state.state === InnerWormState.InMotion) {
      // Clear any tween if we're falling.
      this.motionTween = undefined;
      this.impactVelocity = Math.max(
        magnitude(this.body.linvel()),
        this.impactVelocity,
      );
      if (!this.body.isMoving()) {
        // Stopped moving, must not be in motion anymore.
        this.state.transition(this.state.statePriorToMotion);
        this.state.voidStatePriorToMotion();
        // Gravity does not affect us while we are idle.
        //this.body.setGravityScale(0, false);
        if (this.impactVelocity > Worm.minImpactForDamage) {
          const damage = this.impactVelocity * Worm.impactDamageMultiplier;
          this.reduceHealth(damage);
          this.state.transition(InnerWormState.Inactive);
          this.turnEndedReason = EndTurnReason.FallDamage;
        }
        this.impactVelocity = 0;
      }
    } else if (this.state.isFiring) {
      if (!this.currentWeapon.maxDuration) {
        this.onEndFireWeapon();
      } else if (this.fireWeaponDuration > this.currentWeapon.maxDuration) {
        this.onEndFireWeapon();
      } else {
        this.fireWeaponDuration += dt;
      }
    } else if (falling) {
      this.resetMoveDirection();
      this.state.transition(InnerWormState.InMotion);
    } else if (
      this.state.state === InnerWormState.MovingLeft ||
      this.state.state === InnerWormState.MovingRight
    ) {
      this.onMove(this.state.state);
      // TODO: Allow moving aim while firing.
    } else if (
      this.state.state === InnerWormState.AimingUp ||
      this.state.state === InnerWormState.AimingDown
    ) {
      this.updateAiming();
    }

    if (this.motionTween) {
      if (this.motionTween.update(dMs)) {
        this.motionTween = undefined;
      }
    }
  }

  public recordState() {
    return {
      ...super.recordState(),
      wormIdent: this.wormIdent.uuid,
      type: EntityType.Worm,
      weapon: this.weapon.code,
      facingRight: this.facingRight,
    };
  }

  destroy(): void {
    super.destroy();
    this.targettingGfx.destroy();
    this.wireframe.renderable.destroy();
    this.weaponSprite.destroy();
    this.arrowSprite.destroy();
    // XXX: This might need to be dead.
    this.state.transition(InnerWormState.Inactive);
    if (this.isSinking) {
      this.toaster?.pushToast(
        templateRandomText(WormDeathSinking, {
          WormName: this.wormIdent.name,
          TeamName: this.wormIdent.team.name,
        }),
        POPUP_DELAY_MS,
      );
      // Sinking death
    }
  }

  public toString() {
    return `[Worm: ${this.wormIdent.name} | ${this.wormIdent.uuid}]`;
  }
}
