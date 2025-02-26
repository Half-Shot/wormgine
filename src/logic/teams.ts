import { ColorSource } from "pixi.js";

export interface WormIdentity {
  uuid?: string;
  name: string;
  health: number;
  maxHealth: number;
}
import { IWeaponCode, IWeaponDefiniton } from "../weapons/weapon";

export interface TeamDefinition {
  name: string;
  group: TeamGroup;
  worms: WormIdentity[];
  flag?: string;
  uuid: string;
  // For net games only
  playerUserId: string | null;
  ammo: Record<IWeaponCode | string, number>;
}

export interface TeamInstanceInterface extends TeamDefinition {
  availableWeapons: [IWeaponDefiniton, number][],
  consumeAmmo: (code: IWeaponCode) => void,
}

export enum TeamGroup {
  Red,
  Blue,
  Green,
  Yellow,
  Purple,
  Orange,
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