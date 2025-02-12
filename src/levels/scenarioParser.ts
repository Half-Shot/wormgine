import { Texture } from "pixi.js";
import { AssetData, AssetTextures } from "../assets/manifest";
import { EntityType } from "../entities/type";
import Logger from "../log";
import { GameRules } from "../logic/gamestate";
import { RecordedEntityState } from "../state/model";
import {
  parseObj,
  TiledForgroundLayer,
  TiledGameRulesProperties,
  TiledLevel,
  TiledObjectLayer,
  TiledTeamProperties,
  TiledTileset,
} from "./types";
import { WormSpawnRecordedState } from "../entities/state/wormSpawn";
import { Team, TeamGroup, WormIdentity } from "../logic/teams";
import { IWeaponCode } from "../weapons/weapon";
import { DefaultWeaponSchema } from "../weapons/schema";
import { getSpawnPoints } from "../terrain/spawner";
import { BaseRecordedState } from "../entities/state/base";

export const COMPATIBLE_TILED_VERSION = "1.11";
const logger = new Logger("scenarioParser");

export interface Scenario {
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

function parseObjectToRecordedState(
  object: ParsedTiledObject,
): BaseRecordedState {
  switch (object.type) {
    case "wormgine.worm_spawn":
      return new WormSpawnRecordedState(object);
    case "wormgine.water":
    case "wormgine.mine":
    case "wormgine.target":
    default:
      return new BaseRecordedState(object);
  }
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

export interface ParsedTiledObject {
  properties: {
    [x: string]: string | number | boolean;
  };
  type: string;
  gid: number;
  id: number;
  x: number;
  y: number;
}

export class ScenarioBuilder {
  public static async fromBlob(
    blob: Blob,
    assets: AssetData,
  ): Promise<ScenarioBuilder> {
    const scenarioMap = JSON.parse(await blob.text()) as TiledLevel;
    return new ScenarioBuilder(scenarioMap, assets);
  }

  public static fromDataAsset(
    name: keyof AssetData,
    assets: AssetData,
  ): ScenarioBuilder {
    if (name in assets === false) {
      throw Error(`Level '${name}' not found`);
    }
    // Tested above.
    const scenarioMap = assets[name] as TiledLevel;
    return new ScenarioBuilder(scenarioMap, assets);
  }

  private readonly objectLayer: TiledObjectLayer;
  private readonly foregroundLayer: TiledForgroundLayer;
  private readonly bitmapAssetName: string;
  private bitmap?: Texture;
  private readonly tileset: TiledTileset;
  private readonly objectState: BaseRecordedState[];
  private readonly providedGameRules: GameRules;
  private readonly providedTeams: Team[];

  get hasWormSpawns() {
    return this.objectLayer.objects.some(
      (o) => o.type === "wormgine.worm_spawn",
    );
  }

  constructor(
    private readonly scenarioMap: TiledLevel,
    assets: AssetData,
  ) {
    this.tileset = loadObjectListing(assets);
    if (scenarioMap.version !== COMPATIBLE_TILED_VERSION) {
      throw Error(
        `Tiled map was built for ${scenarioMap.version}, but we only support ${COMPATIBLE_TILED_VERSION}`,
      );
    }
    const objectLayer = this.scenarioMap.layers.find(
      (l) => l.type === "objectgroup",
    );
    if (!objectLayer) {
      throw Error("Tiled map is missing object layer");
    }
    this.objectLayer = objectLayer;
    const foregroundLayer = scenarioMap.layers.find(
      (l) => l.type === "imagelayer",
    );
    if (!foregroundLayer) {
      throw Error("Tiled map is missing foreground layer");
    }
    this.foregroundLayer = foregroundLayer;

    const prefilteredObjects = this.objectLayer.objects.map((o) =>
      parseObj(o, this.tileset),
    );

    this.providedGameRules = determineRules(
      prefilteredObjects.find((o) => o.type === "wormgine.game_rules")
        ?.properties as unknown as TiledGameRulesProperties,
    );

    this.providedTeams = determineTeams(
      prefilteredObjects
        .filter((o) => o.type === "wormgine.team")
        .map((v) => v.properties as unknown as TiledTeamProperties),
    );

    this.objectState = prefilteredObjects
      .map((oData) => {
        if (oData.type === "unknown") {
          // Skip unknown objects.
          logger.warning("Map had unknown object", oData);
          return;
        }
        return parseObjectToRecordedState(oData);
      })
      .filter((v) => v !== undefined);

    this.bitmapAssetName = "levels_" + foregroundLayer.image.split(".png")[0];
  }

  public loadBitmapFromAssets(
    textures: AssetTextures,
    overrideForegroundName?: string,
  ): ScenarioBuilder {
    const key = (overrideForegroundName ??
      this.bitmapAssetName) as keyof AssetTextures;
    this.bitmap = textures[key];
    if (!this.bitmap) {
      throw Error(`Cannot find texture '${this.bitmapAssetName}'`);
    }
    return this;
  }

  public async loadBitmapFromBlob(blob: Blob): Promise<ScenarioBuilder> {
    this.bitmap = Texture.from(await createImageBitmap(blob));
    if (!this.bitmap) {
      throw Error(`Cannot find texture '${this.bitmapAssetName}'`);
    }
    return this;
  }

  public insertObjects(objects: BaseRecordedState[]): ScenarioBuilder {
    this.objectState.push(...objects);
    return this;
  }

  addSpawns(teams: Team[]): ScenarioBuilder {
    if (!this.bitmap) {
      throw Error("Bitmap hasn't been loaded");
    }
    const newSpawns = getSpawnPoints(this.bitmap, this.objectState, teams);
    this.insertObjects(newSpawns);

    return this;
  }

  public parse() {
    const destructible = !!(
      this.foregroundLayer.properties?.find(
        (v) => v.name === "wormgine.terrain_destructible",
      )?.value ?? true
    );

    if (!this.bitmap) {
      throw Error("Bitmap hasn't been loaded");
    }

    return {
      terrain: {
        bitmap: this.bitmap,
        x: this.foregroundLayer.offsetx ?? this.foregroundLayer.x,
        y: this.foregroundLayer.offsety ?? this.foregroundLayer.y,
        destructible,
      },
      objects: this.objectState,
      rules: this.providedGameRules,
      teams: this.providedTeams,
    };
  }
  public toBlob(): Blob {
    let i = 0;
    const newLevel = JSON.stringify({
      ...this.scenarioMap,
      layers: [
        this.scenarioMap.layers.filter((t) => t.type !== "objectgroup"),
        {
          objects: this.objectState.map((o) => o.toTiledObject(++i)),
          type: "objectgroup",
        } satisfies TiledObjectLayer,
      ],
    });
    return new Blob([newLevel], { type: "application/json" });
  }
}
