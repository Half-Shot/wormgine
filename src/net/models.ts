import { GameStage, ProposedTeam } from "../logic/gameinstance";
import { GameRules } from "../logic/gamestate";
import { TeamDefinition } from "../logic/teams";
import { NetObject } from "./netfloat";

export interface EntityDescriptor {
  pos: { x: number; y: number };
  rot: number;
}

export const GameStageEventType = "uk.half-shot.uk.wormgine.game_stage";
export interface GameStageEvent {
  type: typeof GameStageEventType;
  state_key: "";
  content: {
    stage: GameStage;
  };
}

export const GameActionEventType = "uk.half-shot.wormgine.game_action";
export interface GameActionEvent {
  type: typeof GameActionEventType;
  content: {
    action: Record<string, unknown>;
  };
}

export const GameStateIncrementalEventType = "uk.half-shot.wormgine.game_state";

export interface GameStateIncrementalEvent {
  type: typeof GameStateIncrementalEventType;
  content: {
    iteration: number;
    ents: NetObject[];
  };
}

export const GameConfigEventType = "uk.half-shot.wormgine.game_config";
export interface GameConfigEvent {
  state_key: "";
  type: typeof GameConfigEventType;
  content: {
    rules: GameRules;
    teams: TeamDefinition[];
    level?: {
      name: string;
      data_mxc: string;
      bitmap_mxc: string;
    };
  };
}

export const GameProposedTeamEventType =
  "uk.half-shot.uk.wormgine.proposed_team";

export interface GameProposedTeamEvent {
  state_key: "";
  type: typeof GameProposedTeamEventType;
  content: ProposedTeam | Record<string, never>;
}

export const GameClientReadyEventType = "uk.half-shot.uk.wormgine.ready";
export interface GameClientReadyEvent {
  type: typeof GameClientReadyEventType;
  content: Record<string, never>;
}
