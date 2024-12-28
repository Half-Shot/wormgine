import { ColorSource } from "pixi.js";
import { IWeaponCode, IWeaponDefiniton } from "../weapons/weapon";
import { WormIdentity, WormInstance } from "./worminstance";
import { getDefinitionForCode } from "../weapons";

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
  ammo: Record<IWeaponCode|string, number>;
}

export function teamGroupToColorSet(group: TeamGroup): {
  bg: ColorSource;
  fg: ColorSource;
} {
  switch (group) {
    case TeamGroup.Red:
      return { bg: 0xcc3333, fg: 0xbb5555 };
    case TeamGroup.Blue:
      return { bg: 0x2244cc, fg: 0x3366cc };
    default:
      return { bg: 0xcc00cc, fg: 0x111111 };
  }
}

export class InternalTeam implements Team {
  public readonly worms: WormInstance[];
  private nextWormStack: WormInstance[];
  public readonly ammo: Team["ammo"];

  public get availableWeapons() {
    return Object.entries(this.ammo)
      .filter(([_code, ammo]) => ammo !== 0)
      .map<[IWeaponDefiniton, number]>(([code, ammo]) => [
        getDefinitionForCode(code as IWeaponCode),
        ammo,
      ]);
  }

  constructor(
    private readonly team: Team,
    onHealthChange: () => void,
  ) {
    this.worms = team.worms.map(
      (w) => new WormInstance(w, this, onHealthChange),
    );
    this.nextWormStack = [...this.worms];
    this.ammo = { ...team.ammo };
  }

  get name() {
    return this.team.name;
  }

  get playerUserId() {
    return this.team.playerUserId;
  }

  get group() {
    return this.team.group;
  }

  get health() {
    return this.worms.map((w) => w.health).reduce((a, b) => a + b);
  }

  get maxHealth() {
    return this.worms.map((w) => w.maxHealth).reduce((a, b) => a + b);
  }

  public popNextWorm(): WormInstance {
    // Clear any dead worms
    this.nextWormStack = this.nextWormStack.filter((w) => w.health > 0);
    const [next] = this.nextWormStack.splice(0, 1);
    if (!next) {
      throw Error("Exhausted all worms from team");
    }
    this.nextWormStack.push(next);
    return next;
  }

  public consumeAmmo(code: IWeaponCode) {
    if (this.ammo[code] === 0) {
      throw Error('Cannot consume ammo, no ammo left');
    }
    this.ammo[code]--;
  }
}

export { WormInstance };
