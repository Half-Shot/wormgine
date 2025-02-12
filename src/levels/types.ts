interface TiledProperty<T, X> {
  name: string;
  type: T;
  value: X;
}

type Properties = (
  | TiledProperty<"int", number>
  | TiledProperty<"string", string>
  | TiledProperty<"boolean", boolean>
)[];

export interface TiledTileset {
  name: string;
  version: string;
  type: "tileset";
  tiles: [
    {
      id: number;
      type: string;
      properties?: Properties;
      imageheight: number;
      imagewidth: number;
    },
  ];
}

export interface TiledForgroundLayer {
  image: string;
  type: "imagelayer";
  offsetx: number;
  offsety: number;
  x: number;
  y: number;
  properties?: Properties;
}

export interface TiledObject {
  /**
   * The object type ID.
   */
  gid: number;
  /**
   * The incremental ID for the individual object.
   */
  id: number;
  properties?: Properties;
  x: number;
  y: number;
  type: string;
}

export interface TiledObjectLayer {
  type: "objectgroup";
  objects: TiledObject[];
}

export interface TiledLevel {
  width: number;
  height: number;
  version: string;
  tilewidth: number;
  tileheight: number;
  type: "map";
  layers: (TiledForgroundLayer | TiledObjectLayer)[];
}

export type TiledGameRulesProperties =
  | TiledGameRulesObjectDestroyedProperties
  | TiledGameRulesDeathmatchProperties;
export interface TiledGameRulesObjectDestroyedProperties {
  "wormgine.end_condition": "ObjectsDestroyed";
  "wormgine.end_condition.objects_destroyed.object_type": string;
}

export interface TiledGameRulesDeathmatchProperties {
  "wormgine.end_condition": "Deathmatch";
}

export type TiledEnumTeamGroup =
  | "Red"
  | "Blue"
  | "Purple"
  | "Yellow"
  | "Orange"
  | "Green";

export interface TiledTeamProperties {
  "wormgine.team_group": TiledEnumTeamGroup;
  "wormgine.team_name": string;
  "wormgine.worm_names": string;
  "wormgine.starting_health"?: number;
  "wormgine.loadout"?: Record<string, number>;
}

export function parseObj(obj: TiledObject, tileset?: TiledTileset) {
  const data = tileset?.tiles.find((tiledata) => tiledata.id === obj.gid - 1);
  return {
    ...obj,
    x: obj.x + (data?.imagewidth ?? 0) / 2,
    y: obj.y - (data?.imageheight ?? 0) / 2,
    properties: {
      ...Object.fromEntries(
        (data?.properties ?? []).map((v) => [v.name, v.value]),
      ),
      ...Object.fromEntries(
        (obj?.properties ?? []).map((v) => [v.name, v.value]),
      ),
    },
    type: data?.type ?? obj.type ?? "unknown",
  };
}
