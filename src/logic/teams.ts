import { ColorSource } from "pixi.js";

export interface WormIdentity {
  uuid?: string;
  name: string;
  health: number;
  maxHealth: number;
}
import { IWeaponCode, IWeaponDefiniton } from "../weapons/weapon";
import { WormInstance } from "./worminstance";
import { getDefinitionForCode } from "../weapons";
import { BehaviorSubject, combineLatest, first, map } from "rxjs";

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
  flag?: string;
  uuid: string;
  // For net games only
  playerUserId: string | null;
  ammo: Record<IWeaponCode | string, number>;
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

export class TeamInstance {
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

  // XXX: Stopgap until we can rxjs more things.
  private healthSubject = new BehaviorSubject<number>(0);
  public readonly health$ = this.healthSubject.asObservable();
  public readonly maxHealth$ = this.healthSubject.pipe(first((v) => v !== 0));

  /**
   * @deprecated Stopgap, use health.
   */
  public get health() {
    return this.healthSubject.value;
  }

  constructor(private readonly team: Team) {
    this.worms = team.worms.map((w) => new WormInstance(w, this));
    this.nextWormStack = [...this.worms];
    this.ammo = { ...team.ammo };
    combineLatest(this.worms.map((w) => w.health$))
      .pipe(map<number[], number>((v) => v.reduce((p, c) => p + c)))
      .subscribe((v) => this.healthSubject.next(v));
  }

  get name() {
    return this.team.name;
  }

  get uuid() {
    return this.team.uuid;
  }

  get playerUserId() {
    return this.team.playerUserId;
  }

  get group() {
    return this.team.group;
  }

  get flag() {
    return this.team.flag;
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
      throw Error("Cannot consume ammo, no ammo left");
    }
    if (this.ammo[code] === -1) {
      // Unlimited
      return;
    }
    this.ammo[code]--;
  }
}

export { WormInstance };
