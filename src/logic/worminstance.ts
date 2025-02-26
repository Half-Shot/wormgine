import { BehaviorSubject, distinct, Observable } from "rxjs";
import Logger from "../log";
import { TeamInstanceInterface } from "./teams";

const logger = new Logger("WormInstance");

export interface WormIdentity {
  uuid?: string;
  name: string;
  health: number;
  maxHealth: number;
}

/**
 * Instance of a worm, keeping track of it's status.
 */
export class WormInstance {
  public readonly uuid;

  private readonly healthSubject: BehaviorSubject<number>;
  public readonly health$: Observable<number>;

  /**
   * @deprecated Use `this.health`.
   */
  public get health(): number {
    return this.healthSubject.value;
  }

  constructor(
    private readonly identity: WormIdentity,
    public readonly team: TeamInstanceInterface,
  ) {
    this.identity = { ...identity };
    this.uuid = identity.uuid ?? globalThis.crypto.randomUUID();
    this.healthSubject = new BehaviorSubject(this.identity.health);
    this.health$ = this.healthSubject.pipe(distinct());
    this.health$.subscribe((health) => {
      logger.debug(
        `Worm (${this.uuid}, ${this.name}) health updated ${health}`,
      );
    });
  }

  get name() {
    return this.identity.name;
  }

  get maxHealth() {
    return this.identity.maxHealth;
  }

  setHealth(health: number) {
    this.healthSubject.next(Math.ceil(health));
  }
}
