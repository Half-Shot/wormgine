import { InputKind } from "../input";
import { GameRules } from "../logic/gamestate";
import { Team } from "../logic/teams";


/**
 * Matrix will need this as an integer, so this will be encoded as an integer
 * and multiplied.
 */
type EncodedFloatingPointNumber = number;

export interface EntityDescriptor {
    pos: {x: EncodedFloatingPointNumber, y: EncodedFloatingPointNumber};
    rot: number;

}

export enum GameStage {
    Lobby = "lobby",
    InProgress = "in_progress",
    Finished = "completed",
}

export interface FullGameStageEvent {
    type: "uk.half-shot.uk.wormgine.game_stage",
    state_key: "",
    content: {
        stage: GameStage,
    }
}

export interface FullGameStateEvent {
    type: "uk.half-shot.uk.wormgine.game_state",
    content: {
        iteration: number;
        bitmap_hash: string;
        ents: EntityDescriptor[];
        teams: Team[];
    }
}

export interface GameControlEvent {
    type: "uk.half-shot.uk.wormgine.game_state",
    content: {
        input: InputKind;
        entity: number; // ?
    }
}

export interface BitmapEvent {
    type: "uk.half-shot.uk.wormgine.bitmap",
    content: {
        mxc: string;
        bitmap_hash: string;
    }
}
export interface BitmapUpdateEvent {
    type: "uk.half-shot.uk.wormgine.bitmap",
    content: {
        b64: string;
        region: { x: number, y: number};
        bitmap_hash: string;
    }
}


export interface PlayerAckEvent {
    type: "uk.half-shot.uk.wormgine.ack",
    content: {
        ack: true
    }
}

export interface GameConfigEvent {
    type: "uk.half-shot.uk.wormgine.game_config",
    content: {
        rules: GameRules
        teams: Team,
        // Need to decide on some config.
    }
}

export interface ClientReadyEvent {
    type: "uk.half-shot.uk.wormgine.ready",
    // Need to decide on some config.
    content: Record<string, never>
}

export interface GameStartEvent {
    type: "uk.half-shot.uk.wormgine.start",
    content: {
        bitmap_hash: string;
        // Need to decide on some config.
    }&GameConfigEvent["content"]
}