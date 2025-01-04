import { BehaviorSubject, Observable, OperatorFunction, pairwise } from "rxjs";

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


export class WormState {
  private innerStatePriorToMotion?: InnerWormState;
  private readonly innerState: BehaviorSubject<InnerWormState>;

  public readonly observeTransition: Observable<[InnerWormState, InnerWormState]>;

  constructor(innerState: InnerWormState) {
    const subjectInnerState = new BehaviorSubject<InnerWormState>(innerState);
    this.observeTransition = subjectInnerState.pipe(pairwise());
    this.innerState = subjectInnerState;
  }

  transition(newState: InnerWormState) {
    if (newState === InnerWormState.InMotion) {
      this.innerStatePriorToMotion = this.innerState.value;
    } else if (newState === InnerWormState.MovingLeft) {
      this.innerStatePriorToMotion = this.innerState.value;
    } else if (newState === InnerWormState.MovingRight) {
      this.innerStatePriorToMotion = this.innerState.value;
    }
    this.innerState.next(newState);
  }

  voidStatePriorToMotion() {
    this.innerStatePriorToMotion = InnerWormState.Idle;
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
    ].includes(this.innerState.value);
  }

  get statePriorToMotion() {
    return this.innerStatePriorToMotion ?? InnerWormState.Idle;
  }

  get shouldUpdate() {
    return this.innerState.value !== InnerWormState.Inactive;
  }

  get active() {
    return this.innerState.value !== InnerWormState.Inactive;
  }

  get shouldHandleNewInput() {
    return (
      this.innerState.value !== InnerWormState.Firing &&
      this.innerState.value !== InnerWormState.InactiveWaiting
    );
  }

  get isFiring() {
    return this.innerState.value === InnerWormState.Firing;
  }

  get canFire() {
    return this.innerState.value === InnerWormState.Idle;
  }

  get showWeapon() {
    return [
      InnerWormState.Firing,
      InnerWormState.Idle,
      InnerWormState.AimingDown,
      InnerWormState.AimingUp,
    ].includes(this.innerState.value);
  }

  get canMove() {
    return (
      this.innerState.value === InnerWormState.Idle ||
      this.innerState.value === InnerWormState.Getaway
    );
  }

  get state() {
    return this.innerState.value;
  }

  get stateName() {
    return InnerWormState[this.innerState.value];
  }

  get isPlaying() {
    return [
      InnerWormState.Idle,
      InnerWormState.InMotion,
      InnerWormState.Getaway,
      InnerWormState.InactiveWaiting,
    ].includes(this.innerState.value);
  }
}
