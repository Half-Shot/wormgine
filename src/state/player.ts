import { EventEmitter } from "pixi.js";
import {
  RecordedEntityState,
  StateRecordEntitySync,
  StateRecordKind,
  StateRecordLine,
  StateRecordWormAction,
  StateRecordWormActionAim,
  StateRecordWormActionFire,
  StateRecordWormActionFireParsed,
  StateRecordWormGameState,
  StateRecordWormSelectWeapon,
} from "./model";
import { GameActionEvent } from "../net/models";
import Logger from "../log";
import { fromNetObject, fromNetworkFloat } from "../net/netfloat";
import { Coordinate } from "../utils";

interface EventTypes {
  started: void;
  entitySync: [StateRecordEntitySync["data"]["entities"]];
  wormAction: [StateRecordWormAction["data"]];
  wormActionAim: [StateRecordWormActionAim["data"]];
  wormActionFire: [StateRecordWormActionFireParsed["data"]];
  wormSelectWeapon: [StateRecordWormSelectWeapon["data"]];
  gameState: [StateRecordWormGameState["data"]];
}

const log = new Logger("StateReplay");

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

  protected _latestEntityData?: (RecordedEntityState & { uuid: string })[];

  public async waitForFullGameState() {
    const startPromise = new Promise<void>((r) =>
      this.once("started", () => r()),
    );
    const gameStatePromise = new Promise<StateRecordWormGameState["data"]>(
      (r) => this.once("gameState", (state) => r(state)),
    );
    const entitySyncPromise = new Promise<
      StateRecordEntitySync["data"]["entities"]
    >((r) => this.once("entitySync", (state) => r(state)));
    const [_start, gameState, entitySync] = await Promise.all([
      startPromise,
      gameStatePromise,
      entitySyncPromise,
    ]);
    return {
      gameState,
      entitySync,
    };
  }

  public get elapsedRelativeLocalTime() {
    return performance.now() - this.localStartTs!;
  }

  public get latestEntityData() {
    return [...(this._latestEntityData ?? [])];
  }

  protected async parseData({
    ts,
    kind,
    index,
    data,
  }: StateRecordLine): Promise<void> {
    if (kind === StateRecordKind.Header) {
      this.emit("started");
      this.lastActionTs = ts;
      this.hostStartTs = ts;
      this.localStartTs = performance.now();
      return;
    } else if (!this.lastActionTs) {
      throw Error("Missing header");
    }
    log.info(`> ${ts} ${kind} ${index} ${data}`);

    const processedData = data as unknown;

    switch (kind) {
      case StateRecordKind.EntitySync:
        // TODO: Apply deltas somehow.
        this._latestEntityData = (
          processedData as StateRecordEntitySync
        ).data.entities;
        this.emit(
          "entitySync",
          (processedData as StateRecordEntitySync).data.entities,
        );
        break;
      case StateRecordKind.WormAction: {
        const actionData = processedData as StateRecordWormAction;
        this.emit("wormAction", actionData.data);
        break;
      }
      case StateRecordKind.WormActionAim:
        this.emit(
          "wormActionAim",
          processedData as StateRecordWormActionAim["data"],
        );
        break;
      case StateRecordKind.WormActionFire: {
        const fireData = processedData as StateRecordWormActionFire["data"];
        this.emit("wormActionFire", {
          ...fireData,
          opts: {
            ...fireData.opts,
            target: fireData.opts?.target
              ? Coordinate.fromWorld(
                  fromNetworkFloat(fireData.opts.target.x),
                  fromNetworkFloat(fireData.opts.target.y),
                )
              : undefined,
          },
        });
        break;
      }
      case StateRecordKind.WormSelectWeapon:
        this.emit(
          "wormSelectWeapon",
          (processedData as StateRecordWormSelectWeapon).data,
        );
        break;
      case StateRecordKind.GameState:
        this.emit(
          "gameState",
          processedData as StateRecordWormGameState["data"],
        );
        break;
      default:
        throw Error("Unknown state action, possibly older format!");
    }
  }
}
export class TextStateReplay extends StateReplay {
  private stateLines: StateRecordLine[];

  constructor(state: string[]) {
    super();
    this.stateLines = state.map((s) => JSON.parse(s));
  }

  public async play() {
    if (this.hostStartTs != -1) {
      throw Error("Already playing");
    }
    for (const line of this.stateLines) {
      await this.parseData(line);
    }
  }
}

export class MatrixStateReplay extends StateReplay {
  private prevPromise = Promise.resolve();
  constructor() {
    super();
  }

  public async handleEvent(content: GameActionEvent["content"]) {
    this.prevPromise = this.prevPromise.finally(() =>
      this.parseData(fromNetObject(content.action) as StateRecordLine).catch(
        (ex) => {
          console.error("Failed to process line", ex);
        },
      ),
    );
  }
}
