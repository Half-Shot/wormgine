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

  constructor(private innerState: InnerWormState) {}

  transition(newState: InnerWormState) {
    if (newState === InnerWormState.InMotion) {
      this.innerStatePriorToMotion = this.innerState;
    } else if (newState === InnerWormState.MovingLeft) {
      this.innerStatePriorToMotion = this.innerState;
    } else if (newState === InnerWormState.MovingRight) {
      this.innerStatePriorToMotion = this.innerState;
    }
    this.innerState = newState;
  }

  voidStatePriorToMotion() {
    this.innerStatePriorToMotion = InnerWormState.Idle;
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
