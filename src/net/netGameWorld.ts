import { Ticker, UPDATE_PRIORITY } from "pixi.js";
import { GameWorld } from "../world";
import RAPIER from "@dimforge/rapier2d-compat";
import { RecordedEntityState } from "../state/model";
import { PhysicsEntity } from "../entities/phys/physicsEntity";
import Logger from "../log";
import { RunningNetGameInstance } from "./client";

const TICK_EVERY_MS = 200;

const logger = new Logger('NetGameWorld');

export class NetGameWorld extends GameWorld {
    private broadcasting = false;
    private msSinceLastTick = 0;
    private entStateHash = new Map<string, string>();

    constructor(rapierWorld: RAPIER.World, ticker: Ticker, private readonly instance: RunningNetGameInstance) {
        super(rapierWorld, ticker)
    }

    public setBroadcasting(isBroadcasting: boolean) {
        this.broadcasting = isBroadcasting;
        if (this.broadcasting) {
            logger.info('Enabled broadcasting from this client');
            this.ticker.add(this.onTick, undefined, UPDATE_PRIORITY.HIGH);
        } else {
            logger.info('Disabled broadcasting from this client');
            this.ticker.remove(this.onTick);
        }
    }

    public collectEntityState() {
      const state: (RecordedEntityState & { uuid: string })[] = [];
      for (const [uuid, ent] of this.entities.entries()) {
        if ("recordState" in ent === false) {
            // Not recordable.
            break;
        }
        const data = (ent as PhysicsEntity).recordState();
        const hashData = JSON.stringify(data);
        if (this.entStateHash.get(uuid) === hashData) {
            // No updates - skip.
            break;
        }
        this.entStateHash.set(uuid, hashData);
        state.push({
            uuid,
            ...data,
        });
      }
      return state;
    }

    public onTick = (t: Ticker) => {
        this.msSinceLastTick += t.elapsedMS;
        if (this.msSinceLastTick < TICK_EVERY_MS) {
            return;
        }
        this.msSinceLastTick -= TICK_EVERY_MS;

        // Fetch all entities and look for state changes.
        const collectedState = this.collectEntityState();
        if (collectedState.length === 0) {
            // Nothing to send, skip.
            return;
        }
        logger.info(`Found ${collectedState.length} entity updates to send`);
    }
}