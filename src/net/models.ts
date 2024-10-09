import { InputKind } from "../input";
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
        // Need to decide on some config.
    }
}

export interface ClientReadyEvent {
    type: "uk.half-shot.uk.wormgine.ready",
    content: {
        // Need to decide on some config.
    }
}

export interface GameStartEvent {
    type: "uk.half-shot.uk.wormgine.start",
    content: {
        bitmap_hash: string;
        // Need to decide on some config.
    }&GameConfigEvent["content"]
}