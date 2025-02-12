import { ParsedTiledObject } from "../../levels/scenarioParser";
import { TiledObject } from "../../levels/types";
import { RecordedEntityState } from "../../state/model";

export class BaseRecordedState implements RecordedEntityState {
  public type: number | string;
  // Translation
  public tra: { x: number; y: number };
  // Rotation
  public rot: number;
  // Linear velocity
  public vel: { x: number; y: number };
  constructor(obj: Omit<ParsedTiledObject, "id" | "gid">) {
    this.type = obj.type;
    this.tra = {
      x: obj.x,
      y: obj.y,
    };
    this.rot = 0;
    this.vel = {
      x: 0,
      y: 0,
    };
  }
  public toTiledObject(
    id: number,
    properties: TiledObject["properties"] = [],
  ): TiledObject {
    return {
      type: "wormgine.worm_spawn",
      gid: 3,
      id,
      x: this.tra.x,
      y: this.tra.y,
      properties,
    };
  }
}
