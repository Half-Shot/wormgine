interface TiledProperty<T, X> {
  name: string;
  type: T;
  value: X;
}

type Properties = (
  | TiledProperty<"int", number>
  | TiledProperty<"string", string>
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

interface TiledForgroundLayer {
  image: string;
  type: "imagelayer";
  offsetx: number;
  offsety: number;
  x: number;
  y: number;
}

interface TiledObject {
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

interface TiledObjectLayer {
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

export type TiledGameRulesProperties = TiledGameRulesObjectDestroyedProperties|TiledGameRulesDeathmatchProperties;
export interface TiledGameRulesObjectDestroyedProperties {
  "wormgine.end_condition": "ObjectsDestroyed";
  "wormgine.end_condition.objects_destroyed.object_type": string;
}

export interface TiledGameRulesDeathmatchProperties {
  "wormgine.end_condition": "Deathmatch";
}

export type TiledEnumTeamGroup = "Red"|"Blue"|"Purple"|"Yellow"|"Orange"|"Green";

export interface TiledTeamProperties {
  "wormgine.team_group": TiledEnumTeamGroup;
  "wormgine.team_name": string;
  "wormgine.worm_names": string;
  "wormgine.starting_health"?: number;
  "wormgine.loadout": Record<string, number>,
}