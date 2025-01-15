import { RoundState } from "../logic/gamestate";
import { Team, TeamGroup } from "../logic/teams";
import { IWeaponCode } from "../weapons/weapon";


export interface RecordedEntityState {
  type: number | string;
  // Translation
  tra: { x: number; y: number };
  // Rotation
  rot: number;
  // Linear velocity
  vel: { x: number; y: number };
}



export enum StateRecordKind {
  Header = "header",
  EntitySync = "ent_sync",
  WormAction = "worm_action",
  WormActionMove = "worm_action_move",
  WormActionAim = "worm_action_aim",
  WormActionFire = "worm_action_fire",
  WormSelectWeapon = "worm_action_sel_wep",
  GameState = "game_state",
}

export interface StateRecordLine<T extends object = Record<string, unknown>> {
  index: number;
  kind: StateRecordKind;
  data: T;
  ts: number;
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
  round_state: RoundState,
  teams: {
    uuid: string;
    worms: {
      uuid: string;
      name: string;
      health: number;
      maxHealth: number;
    }[];
    ammo: Team["ammo"];
  }[];
  iteration: number;
  wind: number;
}>;
