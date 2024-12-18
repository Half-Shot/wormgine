import { AssetData } from "../assets/manifest";
import { EntityType } from "../entities/type";
import Logger from "../log";
import { GameRules } from "../logic/gamestate";
import { RecordedEntityState } from "../state/model";
import { TiledGameRulesProperties, TiledLevel, TiledTileset } from "./types";

export const COMPATIBLE_TILED_VERSION = "1.10";
const logger = new Logger("scenarioParser");

interface Scenario {
  terrain: {
    bitmap: string;
    x: number;
    y: number;
  };
  objects: RecordedEntityState[];
  rules: GameRules;
}

function parseObjectToRecordedState(object: ParsedObject): RecordedEntityState {
  if (object.type === "wormgine.worm_spawn") {
    return {
      type: "wormgine.worm_spawn",
      tra: {
        x: object.x.toString(),
        y: object.y.toString(),
      },
      rot: "",
      vel: {
        x: "0",
        y: "0",
      },
    };
  }
  if (object.type === "wormgine.water") {
    return {
      type: "wormgine.water",
      tra: {
        x: "0",
        y: object.y.toString(),
      },
      rot: "",
      vel: {
        x: "0",
        y: "0",
      },
    };
  }
  if (object.type === "wormgine.target") {
    return {
      type: "wormgine.target",
      tra: {
        x: object.x.toString(),
        y: object.y.toString(),
      },
      rot: "",
      vel: {
        x: "0",
        y: "0",
      },
    };
  }
  return {
    type: "wormgine.unknown",
    tra: {
      x: object.x.toString(),
      y: object.y.toString(),
    },
    rot: "",
    vel: {
      x: "0",
      y: "0",
    },
  };
}

function determineRules(rules?: TiledGameRulesProperties): GameRules {
  if (!rules) {
    logger.warning("No rules in level, assuming deathmatch");
    return {
      winWhenOneGroupRemains: true,
    };
  }
  if (rules["wormgine.end_condition"] === "objects_destroyed") {
    const obj = rules["wormgine.end_condition.objects_destroyed.object_type"];
    console.log(
      EntityType,
      rules,
      Object.entries(EntityType).find(([k, v]) => v === obj),
    );
    return {
      winWhenAllObjectsOfTypeDestroyed: Object.entries(EntityType).find(
        ([k, v]) => v === obj,
      )?.[1],
    };
  }
  throw Error("Misconfigured rules object");
}

function loadObjectListing(dataAssets: AssetData) {
  const tileset = dataAssets["objects"] as TiledTileset;
  if (tileset.version !== COMPATIBLE_TILED_VERSION) {
    throw Error(
      `Tiled map was built for ${tileset.version}, but we only support ${COMPATIBLE_TILED_VERSION}`,
    );
  }
  return tileset.tiles;
}

interface ParsedObject {
  properties: {
    [x: string]: string | number;
  };
  type: string;
  gid: number;
  id: number;
  x: number;
  y: number;
}

export async function scenarioParser(dataAssets: AssetData): Promise<Scenario> {
  // Load tiled object layer.
  const tileset = loadObjectListing(dataAssets);
  const scenarioMap = dataAssets["targetTraining"] as TiledLevel;
  if (scenarioMap.version !== COMPATIBLE_TILED_VERSION) {
    throw Error(
      `Tiled map was built for ${scenarioMap.version}, but we only support ${COMPATIBLE_TILED_VERSION}`,
    );
  }
  const foregroundLayer = scenarioMap.layers.find(
    (l) => l.type === "imagelayer",
  );
  const objectLayer = scenarioMap.layers.find((l) => l.type === "objectgroup");

  if (!foregroundLayer) {
    throw Error("Tiled map is missing foreground layer");
  }

  if (!objectLayer) {
    throw Error("Tiled map is missing object layer");
  }

  const prefilteredObjects = objectLayer.objects.map((object) => {
    const data = tileset.find((tiledata) => tiledata.id === object.gid - 1);
    console.log(data, object, tileset);
    return {
      ...object,
      x: object.x + (data?.imagewidth ?? 0) / 2,
      y: object.y - (data?.imageheight ?? 0) / 2,
      properties: {
        ...Object.fromEntries(
          (data?.properties ?? []).map((v) => [v.name, v.value]),
        ),
        ...Object.fromEntries(
          (object?.properties ?? []).map((v) => [v.name, v.value]),
        ),
      },
      type: data?.type ?? object.type ?? "unknown",
    };
  });

  const objects = prefilteredObjects
    .map((oData) => {
      if (oData.type === "unknown") {
        // Skip unknown objects.
        logger.warning("Map had unknown object", oData);
        return;
      }
      return parseObjectToRecordedState(oData);
    })
    .filter((v) => v !== undefined);

  const rules = determineRules(
    prefilteredObjects.find((o) => o.type === "wormgine.game_rules")
      ?.properties as unknown as TiledGameRulesProperties,
  );

  return {
    terrain: {
      bitmap: foregroundLayer.image,
      x: foregroundLayer.offsetx ?? foregroundLayer.x,
      y: foregroundLayer.offsety ?? foregroundLayer.y,
    },
    objects,
    rules,
  };
}
