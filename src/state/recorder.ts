import { GameState } from "../logic/gamestate";
import { IWeaponCode } from "../weapons/weapon";
import { GameWorld } from "../world";
import { StateRecordEntitySync, StateRecordHeader, StateRecordKind, StateRecordWormAction, StateRecordWormGameState, StateRecordWormSelectWeapon, StateWormAction } from "./model";

interface StateRecorderStore {
    writeLine(data: Record<string, unknown>): Promise<void>;
}

function hashCode(str: string) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        let chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

export class StateRecorder {
    private recordIndex = 0;
    private entHashes = new Map<string, number>(); // uuid -> hash
    constructor(private readonly gameWorld: GameWorld, private readonly gameState: GameState, private readonly store: StateRecorderStore) {
        this.store.writeLine({
            index: this.recordIndex++,
            data: null,
            kind: StateRecordKind.Header,
            ts: performance.now(),
        } satisfies StateRecordHeader);
    }

    public syncEntityState() {
        let stateToSend = [];
        for (const entState of this.gameWorld.collectEntityState()) {
            const newHash = hashCode(JSON.stringify(entState));
            if (this.entHashes.get(entState.uuid) !== newHash) {
                stateToSend.push(entState);
            }
            this.entHashes.set(entState.uuid, newHash);
        }
        this.store.writeLine({
            index: this.recordIndex++,
            data: {
                entities: stateToSend,
            },
            kind: StateRecordKind.EntitySync,
            ts: performance.now(),
        } satisfies StateRecordEntitySync);
    }

    public recordWormAction(worm: string, action: StateWormAction) {
        this.store.writeLine({
            index: this.recordIndex++,
            data: {
                id: worm,
                action,
            },
            kind: StateRecordKind.WormAction,
            ts: performance.now(),
        } satisfies StateRecordWormAction);
    }

    public recordWormSelectWeapon(worm: string, weapon: IWeaponCode) {
        this.store.writeLine({
            index: this.recordIndex++,
            data: {
                id: worm,
                weapon: weapon,
            },
            kind: StateRecordKind.WormSelectWeapon,
            ts: performance.now(),
        } satisfies StateRecordWormSelectWeapon);
    }


    public recordGameStare() {
        const iteration = this.gameState.iteration;
        const teams = this.gameState.getTeams();
        this.store.writeLine({
            index: this.recordIndex++,
            data: {
                iteration: iteration,
                wind: this.gameState.currentWind,
                teams: teams.map(t => ({
                    name: t.name,
                    group: t.group,
                    worms: t.worms.map(w => ({
                        uuid: w.uuid,
                        name: w.name,
                        health: w.health,
                        maxHealth: w.maxHealth,
                    }))
                })),
            },
            kind: StateRecordKind.GameState,
            ts: performance.now(),
        } satisfies StateRecordWormGameState);
    }
}