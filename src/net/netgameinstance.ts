import { Room, RoomEvent, RoomStateEvent } from "matrix-js-sdk";
import { logger } from "matrix-js-sdk/lib/logger";
import { BehaviorSubject, Observable, map, mergeMap } from "rxjs";
import {
  IGameInstance,
  GameStage,
  ProposedTeam,
  IRunningGameInstance,
} from "../logic/gameinstance";
import { GameRules } from "../logic/gamestate";
import { Team, TeamGroup } from "../logic/teams";
import { WormIdentity } from "../logic/worminstance";
import { StoredTeam } from "../settings";
import { NetGameClient } from "./client";
import {
  GameProposedTeamEventType,
  GameStageEventType,
  GameStageEvent,
  GameConfigEventType,
  GameConfigEvent,
  GameStateIncrementalEvent,
  GameStateIncrementalEventType,
  GameActionEventType,
  GameClientReadyEventType,
} from "./models";
import { RecordedEntityState, StateRecordLine } from "../state/model";
import { MatrixStateReplay } from "../state/player";
import { fromNetObject, toNetworkFloat, toNetObject } from "./netfloat";
import { getAssets } from "../assets";
import { AssetData, AssetTextures } from "../assets/manifest";
import { Texture } from "pixi.js";
import { Scenario, ScenarioBuilder } from "../levels/scenarioParser";

interface NetGameConfiguration {
  myUserId: string;
  hostUserId: string;
  members: Record<string, string>;
  // state_key ->
  teams: Record<string, ProposedTeam>;
  stage: GameStage;
  rules: GameRules;
  level?: {
    mapName: string;
    levelMxc: string;
    terrainMxc: string;
  };
}

export class NetGameInstance implements IGameInstance {
  private readonly _stage: BehaviorSubject<GameStage>;
  public readonly stage: Observable<GameStage>;
  private readonly _members: BehaviorSubject<Record<string, string>>;
  public members: Observable<Record<string, string>>;
  private readonly _proposedTeams: BehaviorSubject<
    Record<string, ProposedTeam>
  >;
  public readonly proposedTeams: Observable<ProposedTeam[]>;
  private readonly _rules: BehaviorSubject<GameRules>;
  public readonly proposedRules: Observable<GameRules>;

  private readonly _level: BehaviorSubject<{
    levelMxc: string;
    terrainMxc: string;
    mapName: string;
  } | null>;

  public readonly terrainThumbnail: Observable<string | null>;
  public readonly mapName: Observable<string>;
  public readonly mapReady: Observable<boolean>;

  public readonly hostUserId: string;
  public readonly isHost: boolean;

  public get myUserId() {
    return this.client.userId;
  }

  public get roomId() {
    return this.room.roomId;
  }

  constructor(
    protected readonly room: Room,
    protected readonly client: NetGameClient,
    initialConfiguration: NetGameConfiguration,
  ) {
    this.hostUserId = initialConfiguration.hostUserId;
    this.isHost =
      initialConfiguration.hostUserId === initialConfiguration.myUserId;
    this._members = new BehaviorSubject<Record<string, string>>(
      initialConfiguration.members,
    );
    this._stage = new BehaviorSubject(initialConfiguration.stage);
    this.stage = this._stage.asObservable();
    this._rules = new BehaviorSubject(initialConfiguration.rules);
    this.proposedRules = this._rules.asObservable();
    this._proposedTeams = new BehaviorSubject(initialConfiguration.teams);
    this.proposedTeams = this._proposedTeams.pipe(map((v) => Object.values(v)));
    this.members = this._members.asObservable();
    this._level = new BehaviorSubject<{
      levelMxc: string;
      terrainMxc: string;
      mapName: string;
    } | null>(initialConfiguration.level ? initialConfiguration.level : null);
    this.mapName = this._level.pipe(map((l) => l?.mapName ?? ""));
    this.mapReady = this._level.pipe(
      map((l) => Boolean(l?.levelMxc && l.terrainMxc)),
    );
    this.terrainThumbnail = this._level.pipe(
      mergeMap(async (v) => {
        if (v?.levelMxc) {
          const blob = await this.client.downloadMedia(
            v.terrainMxc,
            256,
            200,
            "scale",
          );
          return URL.createObjectURL(blob);
        }
        return null;
      }),
    );
    if (!this.room) {
      throw Error("Room not found");
    }

    this.client.client.on(RoomStateEvent.Events, (event, state) => {
      logger.debug("Got room events", event, state);
      if (state.roomId !== this.roomId) {
        return;
      }
      const stateKey = event.getStateKey();
      const type = event.getType();
      logger.debug("Proposing things", stateKey, type, this._stage.value);
      if (
        stateKey &&
        type === GameProposedTeamEventType &&
        this._stage.value === GameStage.Lobby
      ) {
        const content = event.getContent() as ProposedTeam;
        if (Object.keys(content).length > 0) {
          this._proposedTeams.next({
            ...this._proposedTeams.value,
            [stateKey]: content,
          });
        } else {
          this._proposedTeams.next(
            Object.fromEntries(
              Object.entries(this._proposedTeams.value).filter(
                ([sk]) => sk !== stateKey,
              ),
            ),
          );
        }
      } else if (stateKey === "" && type === GameStageEventType) {
        const content = event.getContent() as GameStageEvent["content"];
        this._stage.next(content.stage);
      } else if (stateKey === "" && type === GameConfigEventType) {
        const content = event.getContent() as GameConfigEvent["content"];
        this._rules.next(content.rules);
        logger.info("Got new config event", content.level);
        if (content.level) {
          this._level.next({
            mapName: content.level?.name,
            levelMxc: content.level.data_mxc,
            terrainMxc: content.level.bitmap_mxc,
          });
        }
      }
    });

    this.client.client.on(RoomStateEvent.Members, (_e, _s, member) => {
      if (member.roomId !== this.roomId) {
        return;
      }
      if (member.membership === "join") {
        this._members.next({
          ...this._members.value,
          [member.userId]: member.name,
        });
      } else {
        this._members.next(
          Object.fromEntries(
            Object.entries(this._members.value).filter(
              ([u]) => u !== member.userId,
            ),
          ),
        );
      }
    });
  }

  public async uploadNewLevel(levelAssetName: string, blob: Blob) {
    const { data } = getAssets();
    const texture = Texture.from(await globalThis.createImageBitmap(blob));
    const levelData = data[levelAssetName as keyof AssetData];
    if (!texture) {
      throw Error("Missing texture data");
    }
    if (!levelData) {
      throw Error("Missing level data");
    }
    // Hack to upload the image
    const terrainMxc = await this.client.uploadMedia(blob);
    const levelMxc = await this.client.uploadMedia(
      new Blob([JSON.stringify(levelData)], { type: "application/json" }),
    );
    return this.updateGameConfig({ terrainMxc, levelMxc, mapName: "Testing!" });
  }

  public async chooseNewLevel(levelAssetName: string, bitmapAssetName: string) {
    const { textures, data } = getAssets();
    let texture: Texture;
    if (typeof bitmapAssetName === "string") {
      texture = textures[bitmapAssetName as keyof AssetTextures];
    } else {
      texture = bitmapAssetName;
    }
    const levelData = data[levelAssetName as keyof AssetData];
    if (!texture) {
      throw Error("Missing texture data");
    }
    if (!levelData) {
      throw Error("Missing level data");
    }
    // Hack to upload the image
    const textureReq = await fetch(texture.source._sourceOrigin);
    const textureBlob = await textureReq.blob();
    const terrainMxc = await this.client.uploadMedia(textureBlob);
    const levelMxc = await this.client.uploadMedia(
      new Blob([JSON.stringify(levelData)], { type: "application/json" }),
    );
    return this.updateGameConfig({ terrainMxc, levelMxc, mapName: "Testing!" });
  }

  public canAlterTeam(t: ProposedTeam): boolean {
    return this.isHost || t.playerUserId === this.myUserId;
  }

  public async updateGameConfig(
    newLevel?: { terrainMxc: string; levelMxc: string; mapName: string },
    teams?: Team[],
  ) {
    const levelData = newLevel ?? this._level.value;

    await this.client.client.sendStateEvent(this.roomId, GameConfigEventType, {
      rules: this._rules.value,
      teams: teams ?? [],
      level: levelData
        ? {
            bitmap_mxc: levelData.terrainMxc,
            data_mxc: levelData.levelMxc,
            name: levelData.mapName,
          }
        : undefined,
    } satisfies GameConfigEvent["content"]);
  }

  public async addProposedTeam(
    proposedTeam: StoredTeam,
    wormCount: number,
    teamGroup: TeamGroup,
  ) {
    await this.client.client.sendStateEvent(
      this.roomId,
      GameProposedTeamEventType,
      {
        ...proposedTeam,
        group: teamGroup,
        wormCount,
        playerUserId: this.client.userId,
      },
      proposedTeam.uuid,
    );
  }

  public async updateProposedTeam(
    proposedTeam: ProposedTeam,
    updates: { wormCount?: number; teamGroup?: TeamGroup },
  ) {
    await this.client.client.sendStateEvent(
      this.roomId,
      GameProposedTeamEventType,
      {
        ...proposedTeam,
        ...(updates.teamGroup !== undefined && { group: updates.teamGroup }),
        ...(updates.wormCount !== undefined && {
          wormCount: updates.wormCount,
        }),
      },
      proposedTeam.uuid,
    );
  }

  public async removeProposedTeam(proposedTeam: ProposedTeam) {
    await this.client.client.sendStateEvent(
      this.roomId,
      GameProposedTeamEventType,
      {},
      proposedTeam.uuid,
    );
  }

  public async startGame() {
    const levelValue = this._level.value;
    if (!levelValue) {
      throw Error("Level not set");
    }

    const bitmapData = await this.client.downloadMedia(levelValue.terrainMxc);
    const levelData = await this.client.downloadMedia(levelValue.levelMxc);

    const assets = getAssets();
    const builder = await ScenarioBuilder.fromBlob(levelData, assets.data);
    builder.loadBitmapFromBlob(bitmapData);

    const teams: Team[] = Object.values(this._proposedTeams.value).map((v) => ({
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

    let levelMxc = levelValue.levelMxc;

    if (!builder.hasWormSpawns) {
      // TODO: We assume if there are no spawn points then we are fine to add in our own, but there
      // should be a better switch for this
      builder.addSpawns(teams);
      const newLevel = builder.toBlob();
      levelMxc = await this.client.uploadMedia(newLevel);
    }

    await this.updateGameConfig(
      {
        terrainMxc: levelValue.terrainMxc,
        levelMxc,
        mapName: levelValue.mapName,
      },
      teams,
    );
    await this.client.client.sendStateEvent(this.roomId, GameStageEventType, {
      stage: GameStage.InProgress,
    } satisfies GameStageEvent["content"]);
  }

  public async exitGame() {
    // TODO: Perform any cleanup
    await this.client.client.leave(this.roomId);
  }

  public async sendGameState(data: GameStateIncrementalEvent["content"]) {
    await this.client.client.sendEvent(
      this.roomId,
      GameStateIncrementalEventType,
      data,
    );
  }
}

type DecodedGameState = {
  iteration: number;
  ents: (RecordedEntityState & { uuid: string })[];
};

export class RunningNetGameInstance
  extends NetGameInstance
  implements IRunningGameInstance
{
  private readonly _gameConfig: BehaviorSubject<GameConfigEvent["content"]>;
  public readonly gameConfig: Observable<GameConfigEvent["content"]>;
  private readonly _gameState: BehaviorSubject<DecodedGameState>;
  public readonly gameState: Observable<DecodedGameState>;
  public readonly player: MatrixStateReplay;

  public get gameConfigImmediate() {
    return this._gameConfig.value;
  }
  public get gameHasStarted() {
    return this._gameState.value.iteration > 0;
  }

  public get rules() {
    return this.initialConfig.rules;
  }

  constructor(
    room: Room,
    client: NetGameClient,
    private readonly initialConfig: NetGameConfiguration,
    currentState: GameConfigEvent["content"],
    public readonly scenario: Scenario,
  ) {
    super(room, client, initialConfig);
    this._gameConfig = new BehaviorSubject(currentState);
    this.gameConfig = this._gameConfig.asObservable();
    this._gameState = new BehaviorSubject({
      iteration: 0,
      ents: [] as DecodedGameState["ents"],
    });
    this.gameState = this._gameState.asObservable();
    this.player = new MatrixStateReplay();
    room.on(RoomStateEvent.Events, (event) => {
      const stateKey = event.getStateKey();
      const type = event.getType();
      if (
        stateKey &&
        type === GameConfigEventType &&
        event.getSender() !== this.myUserId
      ) {
        const content = fromNetObject(
          event.getContent() as GameConfigEvent["content"],
        );
        this._gameConfig.next(content as GameConfigEvent["content"]);
      }
    });
    room.on(RoomEvent.Timeline, (event) => {
      const type = event.getType();
      // Filter our won events out.
      if (
        type === GameActionEventType &&
        !event.isState() &&
        event.getSender() !== this.myUserId
      ) {
        void this.player.handleEvent(event.getContent());
      }
      if (
        type === GameStateIncrementalEventType &&
        event.getSender() !== this.myUserId
      ) {
        const content = fromNetObject(
          event.getContent() as GameStateIncrementalEvent["content"],
        ) as {
          iteration: number;
          ents: (RecordedEntityState & { uuid: string })[];
        };
        logger.info("Got new incremental event", content);
        this._gameState.next(content);
      }
    });
  }

  writeAction(act: StateRecordLine) {
    const packet: Record<keyof typeof act, unknown> = {
      ts: toNetworkFloat(act.ts),
      kind: act.kind,
      index: act.index,
      data: toNetObject(act.data),
    };
    return this.client.client.sendEvent(this.roomId, GameActionEventType, {
      action: packet,
    });
  }

  async ready() {
    return this.client.client.sendEvent(
      this.roomId,
      GameClientReadyEventType,
      {},
    );
  }

  async allClientsReady() {
    const setOfReady = new Set<string>([
      ...(this.room
        .getLiveTimeline()
        .getEvents()
        .filter((e) => e.getType() === GameClientReadyEventType)
        .map((e) => e.getSender()) as string[]),
    ]);

    const expectedCount = Object.values(this.initialConfig.members).length;
    logger.info("Ready check", expectedCount, setOfReady);
    if (setOfReady.size === expectedCount) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.room.on(RoomEvent.Timeline, (event) => {
        if (event.getType() === GameClientReadyEventType && !event.isState()) {
          setOfReady.add(event.getSender()!);
        }
        logger.info("Ready check", expectedCount, setOfReady);
        if (setOfReady.size === expectedCount) {
          resolve();
        }
      });
    });
  }
}
