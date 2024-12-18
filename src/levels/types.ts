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

export type TiledGameRulesProperties = TiledGameRulesObjectDestroyedProperties;
export interface TiledGameRulesObjectDestroyedProperties {
  "wormgine.end_condition": "objects_destroyed";
  "wormgine.end_condition.objects_destroyed.object_type": string;
}
