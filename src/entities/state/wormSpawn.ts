import { ParsedTiledObject } from "../../levels/scenarioParser";
import { TiledEnumTeamGroup, TiledObject } from "../../levels/types";
import { TeamGroup } from "../../logic/teams";
import { BaseRecordedState } from "./base";

export class WormSpawnRecordedState extends BaseRecordedState {
  public wormUuid?: string;
  public teamGroup?: TeamGroup;

  constructor(object: Omit<ParsedTiledObject, "id" | "gid">) {
    super(object);
    this.teamGroup =
      TeamGroup[object.properties["wormgine.team_group"] as TiledEnumTeamGroup];
    this.wormUuid = object.properties["wormgine.worm_uuid"] as string;
  }

  toTiledObject(id: number): TiledObject {
    const properties: TiledObject["properties"] = [];
    if (this.wormUuid) {
      properties.push({
        type: "string",
        name: "wormgine.worm_uuid",
        value: this.wormUuid,
      });
    }
    if (this.teamGroup) {
      properties.push({
        type: "string",
        name: "wormgine.team_group",
        value: this.teamGroup as unknown as string,
      });
    }
    return super.toTiledObject(id, properties);
  }
}
