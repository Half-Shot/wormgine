import Logger from "../log";
import { InternalTeam, Team } from "./teams";

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
  constructor(
    private readonly identity: WormIdentity,
    public readonly team: InternalTeam,
    private readonly onHealthUpdated: () => void,
  ) {
    this.uuid = identity.uuid ?? globalThis.crypto.randomUUID();
  }

  get name() {
    return this.identity.name;
  }

  get maxHealth() {
    return this.identity.maxHealth;
  }

  get health() {
    return this.identity.health;
  }

  set health(health: number) {
    logger.debug(`Worm (${this.uuid}, ${this.name}) health updated ${health}`);
    this.identity.health = health;
    this.onHealthUpdated();
  }
}
