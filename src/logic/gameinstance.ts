import { BehaviorSubject, map, Observable, of } from "rxjs";
import { GameRules } from "./gamestate";
import { StoredTeam } from "../settings";
import { TeamDefinition, TeamGroup, WormIdentity } from "./teams";
import { DefaultWeaponSchema } from "../weapons/schema";
import { StateRecordLine } from "../state/model";
import { Scenario, ScenarioBuilder } from "../levels/scenarioParser";
import { getAssets } from "../assets";
import { AssetData, AssetTextures } from "../assets/manifest";
import { Texture } from "pixi.js";

export enum GameStage {
  Lobby = "lobby",
  InProgress = "in_progress",
  Finished = "completed",
}

export interface ProposedTeam extends StoredTeam {
  playerUserId: string;
  group: TeamGroup;
  wormCount: number;
}

export interface IGameInstance {
  canAlterTeam(t: ProposedTeam): boolean;
  updateProposedTeam(
    t: ProposedTeam,
    updates: { wormCount?: number; teamGroup?: TeamGroup },
  ): Promise<unknown>;
  removeProposedTeam(team: ProposedTeam): Promise<unknown>;
  addProposedTeam(
    team: StoredTeam,
    maxWorms: number,
    teamGroup: TeamGroup,
  ): Promise<unknown>;
  startGame(): Promise<void>;
  exitGame(): void;
  chooseNewLevel(
    levelAssetName: string,
    bitmapAssetName: string,
  ): Promise<void>;
  uploadNewLevel(levelAssetName: string, bitmap: Blob): Promise<void>;
  members: Observable<Record<string, string>>;
  stage: Observable<GameStage>;
  proposedRules: Observable<GameRules>;
  proposedTeams: Observable<ProposedTeam[]>;
  terrainThumbnail: Observable<string | null>;
  mapName: Observable<string>;
  mapReady: Observable<boolean>;
  isHost: boolean;
  hostUserId: string;
  myUserId: string;
}

export interface IRunningGameInstance extends IGameInstance {
  writeAction(data: StateRecordLine<Record<string, unknown>>): unknown;
  gameConfigImmediate: { teams: TeamDefinition[]; rules: GameRules };
  scenario: Scenario;
}

export class LocalGameInstance implements IRunningGameInstance {
  public readonly isHost = true;
  public readonly hostUserId = "me";
  public readonly myUserId = "me";
  private readonly _stage: BehaviorSubject<GameStage>;
  public readonly stage: Observable<GameStage>;
  public members: Observable<Record<string, string>>;
  private readonly _proposedTeams: BehaviorSubject<
    Record<string, ProposedTeam>
  >;
  public readonly proposedTeams: Observable<ProposedTeam[]>;
  private readonly _rules: BehaviorSubject<GameRules>;
  public readonly proposedRules: Observable<GameRules>;

  private readonly _level: BehaviorSubject<{
    levelAsset: string;
    terrainAsset: string | Blob;
    mapName: string;
  } | null>;

  public readonly terrainThumbnail: Observable<string | null>;
  public readonly mapName: Observable<string>;
  public readonly mapReady: Observable<boolean>;

  // TODO: This is probably a bit gross. We set this once.
  public finalTeams!: TeamDefinition[];
  public scenario!: Scenario;

  constructor() {
    this.members = of({ [this.hostUserId]: "Me" });
    // TODO: Odd types?
    this._stage = new BehaviorSubject(GameStage.Lobby as GameStage);
    this.stage = this._stage.asObservable();
    this._rules = new BehaviorSubject({
      wormHealth: 100,
      winWhenOneGroupRemains: true,
      ammoSchema: DefaultWeaponSchema,
    } as GameRules);
    this.proposedRules = this._rules.asObservable();
    this._proposedTeams = new BehaviorSubject({});
    this.proposedTeams = this._proposedTeams.pipe(map((v) => Object.values(v)));

    this._level = new BehaviorSubject<{
      levelAsset: string;
      terrainAsset: string | Blob;
      mapName: string;
    } | null>(null);
    this.mapName = this._level.pipe(map((l) => l?.mapName ?? "Unknown map"));
    const assets = getAssets();
    this.terrainThumbnail = this._level.pipe(
      map((level) => {
        if (typeof level?.terrainAsset === "string") {
          return assets.textures[
            level?.terrainAsset as unknown as keyof AssetTextures
          ].source._sourceOrigin;
        } else if (level?.terrainAsset) {
          return URL.createObjectURL(level.terrainAsset);
        }
        return null;
      }),
    );
    this.mapReady = this._level.pipe(
      map((l) => Boolean(l?.levelAsset && l.terrainAsset)),
    );
  }

  public get gameConfigImmediate() {
    return {
      rules: this._rules.value,
      teams: this.finalTeams,
    };
  }

  canAlterTeam(): true {
    return true;
  }

  async uploadNewLevel(levelAssetName: string, bitmap: Blob): Promise<void> {
    this._level.next({
      mapName: "TestingMapName",
      levelAsset: levelAssetName,
      terrainAsset: bitmap,
    });
  }

  async chooseNewLevel(levelAssetName: string, bitmapAssetName: string) {
    this._level.next({
      mapName: "TestingMapName",
      levelAsset: levelAssetName,
      terrainAsset: bitmapAssetName,
    });
  }

  async updateProposedTeam(
    t: ProposedTeam,
    updates: { wormCount?: number; teamGroup?: TeamGroup },
  ): Promise<void> {
    if (updates.teamGroup) {
      t.group = updates.teamGroup;
    }
    if (updates.wormCount) {
      t.wormCount = updates.wormCount;
    }
    this._proposedTeams.next({
      ...this._proposedTeams.value,
      [t.uuid]: t,
    });
  }

  async removeProposedTeam(team: ProposedTeam): Promise<void> {
    this._proposedTeams.next(
      Object.fromEntries(
        Object.entries(this._proposedTeams.value).filter(
          ([k]) => k !== team.uuid,
        ),
      ),
    );
  }

  async addProposedTeam(
    team: StoredTeam,
    wormCount: number,
    group: TeamGroup,
  ): Promise<void> {
    this._proposedTeams.next({
      ...this._proposedTeams.value,
      [team.uuid]: {
        ...team,
        group,
        wormCount,
        playerUserId: this.hostUserId,
      } as ProposedTeam,
    });
  }

  async startGame() {
    this.finalTeams = Object.values(this._proposedTeams.value).map((v) => ({
      name: v.name,
      flag: v.flagb64,
      group: v.group,
      playerUserId: v.playerUserId,
      uuid: v.uuid,
      // Needs to come from rules.
      ammo: this._rules.value.ammoSchema,
      worms: v.worms.slice(0, v.wormCount).map(
        (w) =>
          ({
            name: w,
            health: this._rules.value.wormHealth,
            maxHealth: this._rules.value.wormHealth,
            uuid: globalThis.crypto.randomUUID(),
          }) satisfies WormIdentity,
      ),
    }));

    const levelData = this._level.value;

    if (!levelData) {
      throw Error("No level data!");
    }

    const texture: Texture | string =
      typeof levelData.terrainAsset === "object"
        ? Texture.from(await createImageBitmap(levelData.terrainAsset))
        : levelData.terrainAsset;

    if (!texture) {
      throw Error("Expected texture");
    }

    const assets = getAssets();
    const builder = ScenarioBuilder.fromDataAsset(
      levelData.levelAsset as keyof AssetData,
      assets.data,
    );
    if (typeof levelData.terrainAsset === "string") {
      builder.loadBitmapFromAssets(assets.textures);
    } else {
      await builder.loadBitmapFromBlob(levelData.terrainAsset);
    }
    // Load the scenario
    if (!builder.hasWormSpawns) {
      // TODO: We assume if there are no spawn points then we are fine to add in our own, but there
      // should be a better switch for this.
      builder.addSpawns(this.finalTeams);
    }
    this.scenario = builder.parse();

    this._stage.next(GameStage.InProgress);
  }

  exitGame() {
    // Do nothing.
  }

  writeAction() {
    // Do nothing
  }
}
