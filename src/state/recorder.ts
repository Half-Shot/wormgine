import { IWeaponCode } from "../weapons/weapon";
import { GameWorld } from "../world";
import {
  StateRecordEntitySync,
  StateRecordHeader,
  StateRecordKind,
  StateRecordLine,
  StateRecordWormAction,
  StateRecordWormActionAim,
  StateRecordWormActionFire,
  StateRecordWormActionMove,
  StateRecordWormGameState,
  StateRecordWormSelectWeapon,
  StateWormAction,
} from "./model";

export interface StateRecorderStore {
  writeLine(data: StateRecordLine): Promise<void>;
}

function hashCode(str: string) {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

export class StateRecorder {
  public static RecorderVersion = 2;
  private recordIndex = 0;
  private entHashes = new Map<string, number>(); // uuid -> hash
  constructor(private readonly store: StateRecorderStore) {}

  public writeHeader() {
    this.store.writeLine({
      index: ++this.recordIndex,
      data: { version: StateRecorder.RecorderVersion },
      kind: StateRecordKind.Header,
      ts: performance.now(),
    } satisfies StateRecordHeader);
  }

  public syncEntityState(gameWorld: GameWorld) {
    console.log("Stubbed syncEntityState");
    // const stateToSend = [];
    // for (const entState of gameWorld.collectEntityState()) {
    //   const newHash = hashCode(JSON.stringify(entState));
    //   if (this.entHashes.get(entState.uuid) !== newHash) {
    //     stateToSend.push(entState);
    //   }
    //   this.entHashes.set(entState.uuid, newHash);
    // }
    // this.store.writeLine({
    //   index: ++this.recordIndex,
    //   data: {
    //     entities: stateToSend,
    //   },
    //   kind: StateRecordKind.EntitySync,
    //   ts: performance.now(),
    // } satisfies StateRecordEntitySync);
  }

  public recordWormAction(worm: string, action: StateWormAction) {
    this.store.writeLine({
      index: ++this.recordIndex,
      data: {
        id: worm,
        action,
      },
      kind: StateRecordKind.WormAction,
      ts: performance.now(),
    } satisfies StateRecordWormAction);
  }

  public recordWormMove(
    worm: string,
    direction: "left" | "right",
    cycles: number,
  ) {
    this.store.writeLine({
      index: ++this.recordIndex,
      data: {
        id: worm,
        cycles,
        action:
          direction === "left"
            ? StateWormAction.MoveLeft
            : StateWormAction.MoveRight,
      },
      kind: StateRecordKind.WormActionMove,
      ts: performance.now(),
    } satisfies StateRecordWormActionMove);
  }

  public recordWormAim(worm: string, direction: "up" | "down", angle: number) {
    this.store.writeLine({
      index: ++this.recordIndex,
      data: {
        id: worm,
        angle: angle.toString(),
        dir: direction,
        action: StateWormAction.Aim,
      },
      kind: StateRecordKind.WormActionAim,
      ts: performance.now(),
    } satisfies StateRecordWormActionAim);
  }

  public recordWormFire(worm: string, duration: number) {
    this.store.writeLine({
      index: ++this.recordIndex,
      data: {
        id: worm,
        duration,
        action: StateWormAction.Fire,
      },
      kind: StateRecordKind.WormActionFire,
      ts: performance.now(),
    } satisfies StateRecordWormActionFire);
  }

  public recordWormSelectWeapon(worm: string, weapon: IWeaponCode) {
    this.store.writeLine({
      index: ++this.recordIndex,
      data: {
        id: worm,
        weapon: weapon,
      },
      kind: StateRecordKind.WormSelectWeapon,
      ts: performance.now(),
    } satisfies StateRecordWormSelectWeapon);
  }
  public recordGameState(data: StateRecordWormGameState["data"]) {
    console.log("Recording game state", data.round_state);
    this.store.writeLine({
      index: ++this.recordIndex,
      data: data,
      kind: StateRecordKind.GameState,
      ts: performance.now(),
    } satisfies StateRecordWormGameState);
  }
}
