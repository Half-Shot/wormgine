import TypedEmitter from "typed-emitter";
import { EventEmitter } from "events";

export enum InnerWormState {
  Idle = 0,
  InMotion = 1,
  Firing = 2,
  MovingLeft = 3,
  MovingRight = 4,
  AimingUp = 5,
  AimingDown = 6,
  Getaway = 7,
  InactiveWaiting = 98,
  Inactive = 99,
}

type Events = {
  transition: (before: InnerWormState, after: InnerWormState) => void;
};

export class WormState extends (EventEmitter as new () => TypedEmitter<Events>) {
  private innerStatePriorToMotion?: InnerWormState;
  private isGetaway = false;

  constructor(private innerState: InnerWormState) {
    super();
  }

  transition(newState: InnerWormState) {
    // Once we mark a worm as getaway, do not allow them to go back to an idle state.
    if (newState === InnerWormState.Getaway) {
      this.isGetaway = true;
    } else if (newState === InnerWormState.Inactive) {
      this.isGetaway = false;
    }

    if (newState === InnerWormState.InMotion) {
      this.innerStatePriorToMotion = this.innerState;
    } else if (newState === InnerWormState.MovingLeft) {
      this.innerStatePriorToMotion = this.innerState;
    } else if (newState === InnerWormState.MovingRight) {
      this.innerStatePriorToMotion = this.innerState;
    }
    const prev = this.innerState;
    this.innerState = newState;
    this.emit("transition", prev, newState);
  }

  voidStatePriorToMotion() {
    this.innerStatePriorToMotion = this.isGetaway
      ? InnerWormState.Getaway
      : InnerWormState.Idle;
  }

  get timerShouldRun() {
    return [
      InnerWormState.Idle,
      InnerWormState.InMotion,
      InnerWormState.MovingLeft,
      InnerWormState.MovingRight,
      InnerWormState.AimingUp,
      InnerWormState.AimingDown,
      InnerWormState.Getaway,
    ].includes(this.innerState);
  }

  get statePriorToMotion() {
    return this.innerStatePriorToMotion ?? InnerWormState.Idle;
  }

  get shouldUpdate() {
    return this.innerState !== InnerWormState.Inactive;
  }

  get active() {
    return this.innerState !== InnerWormState.Inactive;
  }

  get shouldHandleNewInput() {
    return (
      this.innerState !== InnerWormState.Firing &&
      this.innerState !== InnerWormState.InactiveWaiting
    );
  }

  get isFiring() {
    return this.innerState === InnerWormState.Firing;
  }

  get canFire() {
    return this.innerState === InnerWormState.Idle;
  }

  get showWeapon() {
    return [
      InnerWormState.Firing,
      InnerWormState.Idle,
      InnerWormState.AimingDown,
      InnerWormState.AimingUp,
    ].includes(this.innerState);
  }

  get canMove() {
    return (
      this.innerState === InnerWormState.Idle ||
      this.innerState === InnerWormState.Getaway
    );
  }

  get state() {
    return this.innerState;
  }

  get stateName() {
    return InnerWormState[this.innerState];
  }

  get isPlaying() {
    return [
      InnerWormState.Idle,
      InnerWormState.InMotion,
      InnerWormState.Getaway,
      InnerWormState.InactiveWaiting,
    ].includes(this.innerState);
  }
}
