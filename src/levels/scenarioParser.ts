import { Texture } from "pixi.js";
import { AssetData, AssetTextures } from "../assets/manifest";
import { EntityType } from "../entities/type";
import Logger from "../log";
import { GameRules } from "../logic/gamestate";
import { RecordedEntityState } from "../state/model";
import {
  parseObj,
  TiledEnumTeamGroup,
  TiledGameRulesProperties,
  TiledLevel,
  TiledTeamProperties,
  TiledTileset,
} from "./types";
import { WormSpawnRecordedState } from "../entities/state/wormSpawn";
import { Team, TeamGroup, WormIdentity } from "../logic/teams";
import { IWeaponCode } from "../weapons/weapon";
import { DefaultWeaponSchema } from "../weapons/schema";

export const COMPATIBLE_TILED_VERSION = "1.11";
const logger = new Logger("scenarioParser");

interface Scenario {
  terrain: {
    bitmap: Texture;
    destructible: boolean;
    x: number;
    y: number;
  };
  objects: RecordedEntityState[];
  rules: GameRules;
  teams: Team[];
}

function parseObjectToRecordedState(object: ParsedObject): RecordedEntityState {
  if (object.type === "wormgine.worm_spawn") {
    const wp: WormSpawnRecordedState = {
      type: "wormgine.worm_spawn",
      tra: {
        x: object.x,
        y: object.y,
      },
      rot: 0,
      vel: {
        x: 0,
        y: 0,
      },
      teamGroup:
        TeamGroup[
          object.properties["wormgine.team_group"] as TiledEnumTeamGroup
        ],
    };
    return wp;
  }
  if (object.type === "wormgine.water") {
    return {
      type: "wormgine.water",
      tra: {
        x: 0,
        y: object.y,
      },
      rot: 0,
      vel: {
        x: 0,
        y: 0,
      },
    };
  }
  if (object.type === "wormgine.target") {
    return {
      type: "wormgine.target",
      tra: {
        x: object.x,
        y: object.y,
      },
      rot: 0,
      vel: {
        x: 0,
        y: 0,
      },
    };
  }
  return {
    type: "wormgine.unknown",
    tra: {
      x: object.x,
      y: object.y,
    },
    rot: 0,
    vel: {
      x: 0,
      y: 0,
    },
  };
}

function determineTeams(teamProps: TiledTeamProperties[]): Team[] {
  return teamProps.map((tiledTeam) => {
    const health = tiledTeam["wormgine.starting_health"] ?? 100;
    // TODO: Make this cleaner
    const ammo: Team["ammo"] = {};
    for (const [wep, ammoCount] of Object.entries(
      tiledTeam["wormgine.loadout"] ?? {},
    )) {
      ammo[wep as IWeaponCode] = ammoCount;
    }
    return {
      name: tiledTeam["wormgine.team_name"],
      worms: tiledTeam["wormgine.worm_names"]
        .split(";")
        .map<WormIdentity>((wormName) => ({
          name: wormName,
          maxHealth: health,
          health,
        })),
      // TODO: Net games?
      playerUserId: null,
      group: TeamGroup[tiledTeam["wormgine.team_group"]],
      ammo,
      uuid: crypto.randomUUID(),
    };
  });
}

function determineRules(rules?: TiledGameRulesProperties): GameRules {
  if (!rules) {
    logger.warning("No rules in level, assuming deathmatch");
    return {
      winWhenOneGroupRemains: true,
      wormHealth: 100,
      ammoSchema: DefaultWeaponSchema,
    };
  }
  rules["wormgine.end_condition"] ??= "Deathmatch";
  // TODO: Import default values from tiled-project.
  if (rules["wormgine.end_condition"] === "ObjectsDestroyed") {
    const obj = rules["wormgine.end_condition.objects_destroyed.object_type"];
    return {
      winWhenAllObjectsOfTypeDestroyed: Object.entries(EntityType).find(
        ([_k, v]) => v === obj,
      )?.[1],
      wormHealth: 100,
      ammoSchema: DefaultWeaponSchema,
    };
  } else if (rules["wormgine.end_condition"] === "Deathmatch") {
    return {
      winWhenOneGroupRemains: true,
      wormHealth: 100,
      ammoSchema: DefaultWeaponSchema,
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
  return tileset;
}

interface ParsedObject {
  properties: {
    [x: string]: string | number | boolean;
  };
  type: string;
  gid: number;
  id: number;
  x: number;
  y: number;
}

export async function scenarioParser(
  level: string,
  dataAssets: AssetData,
  textureAssets: AssetTextures,
): Promise<Scenario> {
  // Load tiled object layer.
  const tileset = loadObjectListing(dataAssets);
  if (level in dataAssets === false) {
    throw Error(`Level '${level}' not found`);
  }
  // Tested above.
  const scenarioMap = dataAssets[level as keyof AssetData] as TiledLevel;
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

  const prefilteredObjects = objectLayer.objects.map((o) =>
    parseObj(o, tileset),
  );

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

  const bitmapName = "levels_" + foregroundLayer.image.split(".png")[0];
  const bitmap = textureAssets[bitmapName as keyof AssetTextures];
  if (!bitmap) {
    throw Error("Could not find texture for level.");
  }

  const teams = determineTeams(
    prefilteredObjects
      .filter((o) => o.type === "wormgine.team")
      .map((v) => v.properties as unknown as TiledTeamProperties),
  );

  const destructible = !!(
    foregroundLayer.properties?.find(
      (v) => v.name === "wormgine.terrain_destructible",
    )?.value ?? true
  );

  return {
    terrain: {
      bitmap: textureAssets[bitmapName as keyof AssetTextures],
      x: foregroundLayer.offsetx ?? foregroundLayer.x,
      y: foregroundLayer.offsety ?? foregroundLayer.y,
      destructible,
    },
    objects,
    rules,
    teams,
  };
}
