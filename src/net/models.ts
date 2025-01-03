import { InputKind } from "../input";
import { GameRules } from "../logic/gamestate";
import { Team } from "../logic/teams";

/**
 * Matrix will need this as an integer, so this will be encoded as an integer
 * and multiplied.
 */
type EncodedFloatingPointNumber = number;

export interface EntityDescriptor {
  pos: { x: EncodedFloatingPointNumber; y: EncodedFloatingPointNumber };
  rot: number;
}

export enum GameStage {
  Lobby = "lobby",
  InProgress = "in_progress",
  Finished = "completed",
}

export const GameStageEventType = "uk.half-shot.uk.wormgine.game_stage";
export interface GameStageEvent {
  type: typeof GameStageEventType;
  state_key: "";
  content: {
    stage: GameStage;
  };
}

export const GameStateEventType = "uk.half-shot.wormgine.game_state";
export interface FullGameStateEvent {
  type: typeof GameStateEventType;
  content: {
    iteration: number;
    bitmap_hash: string;
    ents: EntityDescriptor[];
    teams: Team[];
  };
}

export interface GameControlEvent {
  type: typeof GameStateEventType;
  content: {
    input: InputKind;
    entity: number; // ?
  };
}

export interface BitmapEvent {
  type: "uk.half-shot.uk.wormgine.bitmap";
  content: {
    mxc: string;
    bitmap_hash: string;
  };
}
export interface BitmapUpdateEvent {
  type: "uk.half-shot.uk.wormgine.bitmap";
  content: {
    b64: string;
    region: { x: number; y: number };
    bitmap_hash: string;
  };
}

export const PlayerAckEventType = "uk.half-shot.uk.wormgine.ack";

export interface PlayerAckEvent {
  type: typeof PlayerAckEventType;
  content: {
    ack: true;
  };
}

export const GameConfigEventType = "uk.half-shot.uk.wormgine.game_config";
export interface GameConfigEvent {
  state_key: "";
  type: typeof GameConfigEventType;
  content: {
    rules: GameRules;
    teams: Team[];
    // Need to decide on some config.
  };
}

export interface ClientReadyEvent {
  type: "uk.half-shot.uk.wormgine.ready";
  // Need to decide on some config.
  content: Record<string, never>;
}

export interface GameStartEvent {
  type: "uk.half-shot.uk.wormgine.start";
  content: {
    bitmap_hash: string;
    // Need to decide on some config.
  } & GameConfigEvent["content"];
}
