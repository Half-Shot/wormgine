import { EventEmitter } from "pixi.js";
import { StateRecordEntitySync, StateRecordKind, StateRecordLine, StateRecordWormAction, StateRecordWormGameState, StateRecordWormSelectWeapon } from "./model";

interface EventTypes {
  'started': void,
  'entitySync': [StateRecordEntitySync["data"]["entities"]],
  'wormAction': [StateRecordWormAction["data"]],
  'wormSelectWeapon': [StateRecordWormSelectWeapon["data"]],
  'gameState': [StateRecordWormGameState["data"]],
}

export class StateReplay extends EventEmitter<EventTypes> {

    private stateLines: StateRecordLine<unknown>[];

    constructor(state: string[]) {
        super();
        this.stateLines = state.map(s => JSON.parse(s));
    }

    public async waitForFullGameState() {
        const startPromise = new Promise<void>(r => this.once('started', () => r()));
        const gameStatePromise = new Promise<StateRecordWormGameState["data"]>(r => this.once('gameState', (state) => r(state)));
        const entitySyncPromise = new Promise<StateRecordEntitySync["data"]["entities"]>(r => this.once('entitySync', (state) => r(state)));
        const [start, gameState, entitySync] = await Promise.all([startPromise, gameStatePromise, entitySyncPromise]);
        return {
            gameState,
            entitySync,
        }
    }


    public async play() {
        let currentTs = 0;
        for (const line of this.stateLines) {
            if (line.kind === StateRecordKind.Header) {
                this.emit('started');
                currentTs = line.ts;
                continue;
            } else if (!currentTs) {
                throw Error('Missing header');
            }
            const waitFor = line.ts - currentTs;
            await new Promise(r => setTimeout(r, waitFor));
            currentTs = line.ts;
            switch (line.kind) {
                case StateRecordKind.EntitySync:
                    this.emit('entitySync', (line as StateRecordEntitySync).data.entities);
                    break;
                case StateRecordKind.WormAction:
                    this.emit('wormAction', (line as StateRecordWormAction).data);
                    break;
                case StateRecordKind.WormSelectWeapon:
                    this.emit('wormSelectWeapon', (line as StateRecordWormSelectWeapon).data);
                    break;
                case StateRecordKind.GameState:
                    this.emit('gameState', (line as StateRecordWormGameState).data);
                    break;
                default:
                    throw Error('Unknown state action, possibly older format!');
            }
        }
    }
}