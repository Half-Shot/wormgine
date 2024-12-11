import { TeamGroup } from "../logic/teams";
import { IWeaponCode } from "../weapons/weapon";

export interface RecordedEntityState {
  type: number;
  // Translation
  tra: { x: string; y: string };
  // Rotation
  rot: string;
  // Linear velocity
  vel: { x: string; y: string };
}

export enum StateRecordKind {
  Header,
  EntitySync,
  WormAction,
  WormActionMove,
  WormActionAim,
  WormActionFire,
  WormSelectWeapon,
  GameState,
}

export interface StateRecordLine<T> {
  index: number;
  kind: StateRecordKind;
  data: T;
  ts: string;
}

export type StateRecordHeader = StateRecordLine<{ version: number }>;

export type StateRecordEntitySync = StateRecordLine<{
  entities: (RecordedEntityState & { uuid: string })[];
}>;

export enum StateWormAction {
  MoveLeft,
  MoveRight,
  Aim,
  Fire,
  Jump,
  Backflip,
}

export type StateRecordWormActionMove = StateRecordLine<{
  id: string;
  action: StateWormAction;
  cycles: number;
}>;

export type StateRecordWormActionAim = StateRecordLine<{
  id: string;
  action: StateWormAction;
  dir: "up" | "down";
  angle: string;
}>;

export type StateRecordWormActionFire = StateRecordLine<{
  id: string;
  action: StateWormAction;
  duration?: number;
}>;

export type StateRecordWormAction = StateRecordLine<{
  id: string;
  action: StateWormAction;
}>;

export type StateRecordWormSelectWeapon = StateRecordLine<{
  id: string;
  weapon: IWeaponCode;
}>;

export type StateRecordWormGameState = StateRecordLine<{
  teams: {
    group: TeamGroup;
    name: string;
    worms: {
      uuid: string;
      name: string;
      health: number;
      maxHealth: number;
    }[];
    playerUserId: string | null;
  }[];
  iteration: number;
  wind: number;
}>;
