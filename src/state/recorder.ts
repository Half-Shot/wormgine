import { toNetworkFloat } from "../net/netfloat";
import { FireOpts, IWeaponCode } from "../weapons/weapon";
import {
  StateRecordHeader,
  StateRecordKind,
  StateRecordLine,
  StateRecordWormAction,
  StateRecordWormActionAim,
  StateRecordWormActionFire,
  StateRecordWormGameState,
  StateRecordWormSelectWeapon,
  StateWormAction,
} from "./model";

export interface StateRecorderStore {
  writeLine(data: StateRecordLine): Promise<void>;
}

export class StateRecorder {
  public static RecorderVersion = 2;
  private recordIndex = 0;
  constructor(private readonly store: StateRecorderStore) {}

  public writeHeader() {
    this.store.writeLine({
      index: ++this.recordIndex,
      data: { version: StateRecorder.RecorderVersion },
      kind: StateRecordKind.Header,
      ts: performance.now(),
    } satisfies StateRecordHeader);
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

  public recordWormFire(worm: string, opts: FireOpts) {
    this.store.writeLine({
      index: ++this.recordIndex,
      data: {
        id: worm,
        opts: {
          ...opts,
          target: opts.target
            ? {
                x: toNetworkFloat(opts.target.worldX),
                y: toNetworkFloat(opts.target.worldY),
              }
            : undefined,
        },
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
    this.store.writeLine({
      index: ++this.recordIndex,
      data: data,
      kind: StateRecordKind.GameState,
      ts: performance.now(),
    } satisfies StateRecordWormGameState);
  }
}
