import { ColorSource } from "pixi.js";
import Logger from "../log";

export interface WormIdentity {
  uuid?: string;
  name: string;
  health: number;
  maxHealth: number;
}

export enum TeamGroup {
  Red,
  Blue,
  Green,
  Yellow,
  Purple,
  Orange,
}

export interface Team {
  name: string;
  group: TeamGroup;
  worms: WormIdentity[];
  // For net games only
  playerUserId: string | null;
}

export function teamGroupToColorSet(group: TeamGroup): {
  bg: ColorSource;
  fg: ColorSource;
} {
  switch (group) {
    case TeamGroup.Red:
      return { bg: 0xcc3333, fg: 0xdb6f6f };
    case TeamGroup.Blue:
      return { bg: 0x2649d9, fg: 0x7085db };
    case TeamGroup.Purple:
      return { bg: 0xa226d9, fg: 0xbb70db };
    case TeamGroup.Yellow:
      return { bg: 0xd9c526, fg: 0xdbcf70 };
    case TeamGroup.Orange:
      return { bg: 0xd97a26, fg: 0xdba270 };
    case TeamGroup.Green:
      return { bg: 0x30d926, fg: 0x75db70 };
    default:
      return { bg: 0xcc00cc, fg: 0x111111 };
  }
}

const logger = new Logger("WormInstance");

/**
 * Instance of a worm, keeping track of it's status.
 */
export class WormInstance {
  public readonly uuid;
  constructor(
    private readonly identity: WormIdentity,
    public readonly team: Team,
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
