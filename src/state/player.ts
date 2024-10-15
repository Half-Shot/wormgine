import { EventEmitter } from "pixi.js";
import { StateRecordEntitySync, StateRecordKind, StateRecordLine, StateRecordWormAction, StateRecordWormActionAim, StateRecordWormActionFire, StateRecordWormActionMove, StateRecordWormGameState, StateRecordWormSelectWeapon } from "./model";
import { NetGameInstance } from "../net/client";

interface EventTypes {
  'started': void,
  'entitySync': [StateRecordEntitySync["data"]["entities"]],
  'wormAction': [StateRecordWormAction["data"]],
  'wormActionMove': [StateRecordWormActionMove["data"]],
  'wormActionAim': [StateRecordWormActionAim["data"]],
  'wormActionFire': [StateRecordWormActionFire["data"]],
  'wormSelectWeapon': [StateRecordWormSelectWeapon["data"]],
  'gameState': [StateRecordWormGameState["data"]],
}

export class StateReplay extends EventEmitter<EventTypes> {
    protected lastActionTs = -1;
    /**
     * The relative time when the playback started from the host.
     */
    protected hostStartTs = -1;
    /**
     * The relative time when the playback started locally.
     */
    protected localStartTs = -1;

    protected waitingForStop?: StateRecordWormAction;
    public async waitForFullGameState() {
        const startPromise = new Promise<void>(r => this.once('started', () => r()));
        const gameStatePromise = new Promise<StateRecordWormGameState["data"]>(r => this.once('gameState', (state) => r(state)));
        const entitySyncPromise = new Promise<StateRecordEntitySync["data"]["entities"]>(r => this.once('entitySync', (state) => r(state)));
        const [_start, gameState, entitySync] = await Promise.all([startPromise, gameStatePromise, entitySyncPromise]);
        return {
            gameState,
            entitySync,
        }
    }

    public get elapsedRelativeLocalTime() {
        return performance.now() - this.localStartTs!;
    }

    protected async parseData(data: StateRecordLine<unknown>): Promise<void> {
        const ts = parseFloat(data.ts);
        if (data.kind === StateRecordKind.Header) {
            this.emit('started');
            this.lastActionTs = ts;
            this.hostStartTs = ts;
            this.localStartTs = performance.now();
            return ;
        } else if (!this.lastActionTs) {
            throw Error('Missing header');
        }
        // Calculate the number of ms to delay since the start of the game.
        const elapsedRelativeTimeForState = ts - this.hostStartTs;
        // and substract the local runtime. (e.g. if the relative time is 10s and we are 5s along, wait 5s)
        const waitFor = elapsedRelativeTimeForState - this.elapsedRelativeLocalTime;

        console.log(ts, elapsedRelativeTimeForState, waitFor, data.data);

        await new Promise(r => setTimeout(r, waitFor));
        this.lastActionTs = ts;
        switch (data.kind) {
            case StateRecordKind.EntitySync:
                this.emit('entitySync', (data as StateRecordEntitySync).data.entities);
                break;
            case StateRecordKind.WormAction: {
                const actionData = data as StateRecordWormAction;
                this.emit('wormAction', actionData.data);
                break;
            }
            case StateRecordKind.WormActionAim:
                this.emit('wormActionAim', (data as StateRecordWormActionAim).data);
                break;
            case StateRecordKind.WormActionMove:
                this.emit('wormActionMove', (data as StateRecordWormActionMove).data);
                break;
            case StateRecordKind.WormActionFire:
                this.emit('wormActionFire', (data as StateRecordWormActionFire).data);
                break;
            case StateRecordKind.WormSelectWeapon:
                this.emit('wormSelectWeapon', (data as StateRecordWormSelectWeapon).data);
                break;
            case StateRecordKind.GameState:
                this.emit('gameState', (data as StateRecordWormGameState).data);
                break;
            default:
                throw Error('Unknown state action, possibly older format!');
        }
    }
}
export class TextStateReplay extends StateReplay {
    private stateLines: StateRecordLine<unknown>[];

    constructor(state: string[]) {
        super();
        this.stateLines = state.map(s => JSON.parse(s));
    }

    public async play() {
        if (this.hostStartTs != -1) {
            throw Error('Already playing');
        }
        for (const line of this.stateLines) {
            await this.parseData(line);
        }
    }
}

export class MatrixStateReplay extends StateReplay {
    constructor(private gameInst: NetGameInstance) {
        super();   
    }

    public async play() {
        if (this.hostStartTs != -1) {
            throw Error('Already playing');
        }
        let prevPromise = Promise.resolve();
        this.gameInst.subscribeToGameState((data) => {
            prevPromise = prevPromise.finally(() => this.parseData(data).catch((ex) => {
                console.error('Failed to process line', ex);
            }));
        });
    }
}
