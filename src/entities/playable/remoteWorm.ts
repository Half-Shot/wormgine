import { Viewport } from "pixi-viewport";
import { WormInstance } from "../../logic/teams";
import { Toaster } from "../../overlays/toaster";
import { Coordinate } from "../../utils";
import { GameWorld } from "../../world";
import { FireFn, Worm, WormRecordedState } from "./worm";
import { StateWormAction } from "../../state/model";
import Logger from "../../log";
import { TweenEngine } from "../../motion/tween";
import { getDefinitionForCode } from "../../weapons";
import { FireOpts } from "../../weapons/weapon";

const logger = new Logger("RemoteWorm");

/**
 * An instance of the worm class controlled by a remote (or AI) player.
 */
export class RemoteWorm extends Worm {
  static create(
    parent: Viewport,
    world: GameWorld,
    position: Coordinate,
    wormIdent: WormInstance,
    onFireWeapon: FireFn,
    toaster?: Toaster,
  ) {
    const ent = new RemoteWorm(
      position,
      world,
      parent,
      wormIdent,
      onFireWeapon,
      toaster,
    );
    world.addBody(ent, ent.physObject.collider);
    parent.addChild(ent.targettingGfx);
    parent.addChild(ent.sprite);
    parent.addChild(ent.wireframe.renderable);
    parent.addChild(ent.healthTextBox);
    return ent;
  }

  private remoteWeaponFireOpts?: FireOpts;

  private constructor(
    position: Coordinate,
    world: GameWorld,
    parent: Viewport,
    wormIdent: WormInstance,
    onFireWeapon: FireFn,
    toaster?: Toaster,
  ) {
    super(position, world, parent, wormIdent, onFireWeapon, toaster, undefined);
  }

  public replayWormAction(remoteAction: StateWormAction) {
    switch (remoteAction) {
      case StateWormAction.Jump:
        this.onJump();
        break;
      case StateWormAction.Backflip:
        this.onBackflip();
        break;
    }
  }

  replayFire(fireOpts: FireOpts) {
    this.onBeginFireWeapon();
    this.remoteWeaponFireOpts = fireOpts;
  }

  update(dt: number, dMs: number) {
    if (this.state.isFiring) {
      if (
        this.remoteWeaponFireOpts?.duration === undefined ||
        this.fireWeaponDuration > this.remoteWeaponFireOpts.duration
      ) {
        logger.debug("firing weapon");
        this.onEndFireWeapon(this.remoteWeaponFireOpts);
        this.remoteWeaponFireOpts = undefined;
      }
    }
    super.update(dt, dMs);
  }

  replayAim(_dir: "up" | "down", aim: number) {
    // TODO: Needs animation.
    this.fireAngle = aim;
  }

  onWormSelected(): void {
    super.onWormSelected(false);
  }

  applyState(state: WormRecordedState): void {
    this.motionTween = new TweenEngine(
      this.body,
      Worm.movementSpeed,
      Coordinate.fromWorld(state.tra),
    );
    this.selectWeapon(getDefinitionForCode(state.weapon));
  }
}
