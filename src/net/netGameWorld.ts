import { Ticker, UPDATE_PRIORITY } from "pixi.js";
import { GameWorld } from "../world";
import RAPIER from "@dimforge/rapier2d-compat";
import { PhysicsEntity } from "../entities/phys/physicsEntity";
import Logger from "../log";
import { RunningNetGameInstance } from "./netgameinstance";
import { NetObject, toNetObject } from "./netfloat";

const TICK_EVERY_MS = 350;

const logger = new Logger("NetGameWorld");

export class NetGameWorld extends GameWorld {
  private broadcasting = false;
  private msSinceLastTick = 0;
  private entStateHash = new Map<string, string>();
  private iteration = 0;

  constructor(
    rapierWorld: RAPIER.World,
    ticker: Ticker,
    private readonly instance: RunningNetGameInstance,
  ) {
    super(rapierWorld, ticker);
    instance.gameState.subscribe((s) => {
      logger.info("Remote state update", s.iteration);
      if (this.broadcasting) {
        return;
      }
      s.ents.forEach((e) => {
        const ent = this.entities.get(e.uuid);
        if (!ent) {
          logger.warning(
            `Could not find entity ${e.uuid} but got state update`,
          );
          return;
        }
        (ent as PhysicsEntity).applyState(e);
      });
    });
  }

  public setBroadcasting(isBroadcasting: boolean) {
    if (this.broadcasting === isBroadcasting) {
      return;
    }
    if (isBroadcasting) {
      logger.info("Enabled broadcasting from this client");
      this.ticker.add(this.onTick, undefined, UPDATE_PRIORITY.HIGH);
    } else {
      logger.info("Disabled broadcasting from this client");
      this.ticker.remove(this.onTick);
    }
    this.broadcasting = isBroadcasting;
  }

  public collectEntityState() {
    const state: NetObject[] = [];
    for (const [uuid, ent] of this.entities.entries()) {
      if ("recordState" in ent === false) {
        // Not recordable.
        continue;
      }
      const data = (ent as PhysicsEntity).recordState();
      const hashData = JSON.stringify(data);
      if (this.entStateHash.get(uuid) === hashData) {
        // No updates - skip.
        continue;
      }
      this.entStateHash.set(uuid, hashData);
      state.push({
        uuid,
        ...toNetObject(data),
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

    logger.debug("Tick!");
    // Fetch all entities and look for state changes.
    const collectedState = this.collectEntityState();
    if (collectedState.length === 0) {
      // Nothing to send, skip.
      return;
    }
    logger.info(`Found ${collectedState.length} entity updates to send`);
    this.instance
      .sendGameState({
        iteration: ++this.iteration,
        ents: collectedState,
      })
      .catch((ex) => {
        logger.warning("Failed to send game state", ex);
      });
  };
}
