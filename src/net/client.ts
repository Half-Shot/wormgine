import {
  GameStageEvent,
  GameConfigEvent,
  GameStage,
  PlayerAckEvent,
  GameStageEventType,
  GameConfigEventType,
  PlayerAckEventType,
  GameStateEventType,
  FullGameStateEvent,
  ProposedTeam,
  GameProposedTeamEventType,
  GameProposedTeamEvent,
} from "./models";
import { EventEmitter } from "pixi.js";
import { StateRecordLine } from "../state/model";
import {
  ClientEvent,
  createClient,
  MatrixClient,
  MatrixError,
  MemoryStore,
  Preset,
  Room,
  RoomEvent,
  RoomStateEvent,
  SyncState,
  Visibility,
} from "matrix-js-sdk";
import { Team, TeamGroup, WormIdentity } from "../logic/teams";
import { GameRules } from "../logic/gamestate";
import { BehaviorSubject, map, Observable, tap } from "rxjs";
import Logger from "../log";
import { StoredTeam, WORMGINE_STORAGE_KEY_CLIENT_CONFIG } from "../settings";

const logger = new Logger("NetClient");

export interface NetClientConfig {
  baseUrl: string;
  accessToken: string;
}

interface NetGameConfiguration {
  myUserId: string;
  hostUserId: string;
  members: Record<string, string>;
  // state_key ->
  teams: Record<string, ProposedTeam>;
  stage: GameStage;
  rules: GameRules;
}

export enum ClientState {
  NotAuthenticated,
  Connecting,
  Connected,
  AuthenticationError,
  OfflineError,
  UnknownError,
}

export class NetGameInstance {
  private readonly _stage: BehaviorSubject<GameStage>;
  public readonly stage: Observable<GameStage>
  private readonly _members: BehaviorSubject<Record<string, string>>;
  public members: Observable<Record<string, string>>;
  private readonly _proposedTeams: BehaviorSubject<
    Record<string, ProposedTeam>
  >;
  public readonly proposedTeams: Observable<ProposedTeam[]>;;
  private readonly _rules: BehaviorSubject<GameRules>;
  public readonly rules: Observable<GameRules>
  public readonly hostUserId: string;
  public readonly isHost: boolean;
  private room: Room;

  public get myUserId() {
    return this.client.userId;
  }

  constructor(
    public readonly roomId: string,
    private readonly client: NetGameClient,
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
    this.room = this.client.client.getRoom(roomId)!;
    this._rules = new BehaviorSubject(initialConfiguration.rules);
    this.rules = this._rules.asObservable();
    this._proposedTeams = new BehaviorSubject(initialConfiguration.teams);
    this.proposedTeams = this._proposedTeams.pipe(map((v) => Object.values(v)));
    this.members = this._members.asObservable();
    if (!this.room) {
      throw Error("Room not found");
    }

    this.client.client.on(RoomStateEvent.Events, (event, state) => {
      if (state.roomId !== this.roomId) {
        return;
      }
      const stateKey = event.getStateKey();
      const type = event.getType();
      console.log("Updating proposed teams");
      if (stateKey && type === GameProposedTeamEventType) {
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

  public async updateGameConfig(newRules: GameRules) {
    await this.client.client.sendStateEvent(this.roomId, GameConfigEventType, {
      rules: newRules,
    } satisfies GameConfigEvent["content"]);
  }

  public async addProposedTeam(
    proposedTeam: StoredTeam,
    wormCount: number,
    teamGroup: TeamGroup = TeamGroup.Red,
  ) {
    console.log("Bumping proposed team to ", teamGroup);
    await this.client.client.sendStateEvent(
      this.roomId,
      GameProposedTeamEventType,
      {
        ...proposedTeam,
        group: teamGroup,
        wormCount,
        playerUserId: this.client.userId,
        // TODO: What should the proper stateKey be?
      },
      `${this.client.userId.slice(1)}/${proposedTeam.name}`,
    );
  }

  public async removeProposedTeam(proposedTeam: ProposedTeam) {
    await this.client.client.sendStateEvent(
      this.roomId,
      GameProposedTeamEventType,
      {},
      `${proposedTeam.playerUserId.slice(1)}/${proposedTeam.name}`,
    );
  }

  public async startGame() {
    const teams: Team[] = Object.values(this._proposedTeams.value).map(v => ({
      name: v.name,
      flag: v.flagb64,
      group: v.group,
      playerUserId: v.playerUserId,
      // Needs to come from rules.
      ammo: this._rules.value.ammoSchema,
      worms: v.worms.map(w => ({
        name: w,
        health: this._rules.value.wormHealth,
        maxHealth: this._rules.value.wormHealth,
        uuid: globalThis.crypto.randomUUID(),
      } satisfies WormIdentity)),
    }));
    // Initial full state of the game.
    await this.client.client.sendStateEvent(this.roomId, GameStateEventType, {
      teams,
      ents: [],
      iteration: 0,
      bitmap_hash: "",
    } satisfies FullGameStateEvent["content"]);
    await this.client.client.sendStateEvent(this.roomId, GameStageEventType, {
      stage: GameStage.InProgress,
    } satisfies GameStageEvent["content"]);
  }

  public async exitGame() {
    // TODO: Perform any cleanup
    await this.client.client.leave(this.roomId);
  }
  public async sendAck() {
    await this.client.client.sendEvent(this.roomId, PlayerAckEventType, {
      ack: true,
    } satisfies PlayerAckEvent["content"]);
  }

  public async sendGameState(data: FullGameStateEvent["content"]) {
    await this.client.client.sendEvent(this.roomId, GameStateEventType, data);
  }

  public subscribeToGameState(_fn: (data: StateRecordLine<unknown>) => void) {
    throw Error("Not implemented");
    this.room.on(RoomEvent.TimelineRefresh, (_room, timelineSet) => {
      console.log(timelineSet.getLiveTimeline().getEvents());
    });
  }
}

const WormgineRoomType = "uk.half-shot.wormgine.v1";

export class NetGameClient extends EventEmitter {
  public readonly client: MatrixClient;
  private readonly clientState = new BehaviorSubject<ClientState>(
    ClientState.NotAuthenticated,
  );
  private myUserId!: string;

  public get userId() {
    return this.myUserId;
  }

  public static getConfig(): NetClientConfig | null {
    // TODO: Validate
    const configStr = localStorage.getItem(WORMGINE_STORAGE_KEY_CLIENT_CONFIG);
    return configStr && JSON.parse(configStr);
  }

  public static clearConfig() {
    localStorage.removeItem(WORMGINE_STORAGE_KEY_CLIENT_CONFIG);
  }

  public static async register(
    homeserverUrl: string,
    name: string,
    password: string,
  ) {
    const client = createClient({
      baseUrl: homeserverUrl,
      fetchFn: (input, init) => globalThis.fetch(input, init),
    });
    return await client.register(name, password, null, {
      type: "m.login.password",
    });
  }
  public static async login(
    homeserverUrl: string,
    username: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const client = createClient({
      baseUrl: homeserverUrl,
      fetchFn: (input, init) => globalThis.fetch(input, init),
      store: new MemoryStore({ localStorage: window.localStorage }),
    });
    const response = await client.loginWithPassword(username, password);
    return { accessToken: response.access_token };
  }

  constructor(config: NetClientConfig) {
    super();
    this.client = createClient({
      baseUrl: config.baseUrl,
      accessToken: config.accessToken,
      fetchFn: (input, init) => globalThis.fetch(input, init),
      store: new MemoryStore({ localStorage: window.localStorage }),
    });
    this.clientState.subscribe((s) =>
      logger.debug("Client state became", ClientState[s]),
    );
  }

  public get state() {
    return this.clientState.pipe();
  }

  public stop() {
    this.client.stopClient();
  }

  public async start() {
    logger.info("Starting netgame client");
    try {
      const whoami = await this.client.whoami();
      this.client.credentials.userId = whoami.user_id;
      this.client.deviceId = whoami.device_id ?? null;
      this.myUserId = whoami.user_id;
      logger.info(`Authenticated as ${whoami.user_id}`);
    } catch (ex) {
      logger.error(`Failed to authenticate`, ex);
      if (ex instanceof MatrixError) {
        if (ex.errcode === "M_UNKNOWN_TOKEN") {
          this.clientState.next(ClientState.AuthenticationError);
        } else {
          this.clientState.next(ClientState.UnknownError);
        }
      } else {
        this.clientState.next(ClientState.UnknownError);
      }
      throw ex;
    }
    this.client.addListener(ClientEvent.Sync, (state) => {
      if (state === SyncState.Prepared) {
        this.clientState.next(ClientState.Connected);
      } else if (state === SyncState.Error) {
        this.clientState.next(ClientState.UnknownError);
      } else {
        logger.debug("Unknown sync state", state);
      }
    });
    this.client.addListener(ClientEvent.SyncUnexpectedError, (err) => {
      console.log("err", err);
    });
    this.clientState.next(ClientState.Connecting);
    await this.client.startClient();
  }

  public async setDisplayname(name: string): Promise<void> {
    await this.client.setDisplayName(name);
  }

  public async createGameRoom(
    initialConfig: GameConfigEvent["content"],
  ): Promise<string> {
    return (
      await this.client.createRoom({
        name: `Wormtrix ${new Date().toUTCString()}`,
        preset: Preset.PublicChat,
        visibility: Visibility.Private,
        creation_content: {
          type: WormgineRoomType,
        },
        power_level_content_override: {
          events: {
            [GameProposedTeamEventType]: 20,
            [GameConfigEventType]: 100,
            [GameStageEventType]: 100,
          },
          // TODO: Forbid lots of other changes.
          state_default: 20,
          users_default: 20,
        },
        initial_state: [
          {
            state_key: "",
            type: "uk.half-shot.uk.wormgine.game_stage",
            content: { stage: GameStage.Lobby },
          } satisfies GameStageEvent,
          {
            state_key: "",
            type: "uk.half-shot.uk.wormgine.game_config",
            content: initialConfig,
          } satisfies GameConfigEvent,
        ],
      })
    ).room_id;
  }

  public async joinGameRoom(roomId: string): Promise<NetGameInstance> {
    // TODO: Check game room is a real game room.
    await this.client.joinRoom(roomId);
    const stateEvents = await this.client.roomState(roomId);
    const createEvent = stateEvents.find((s) => s.type === "m.room.create");
    const stageEvent = stateEvents.find(
      (s) => s.type === "uk.half-shot.uk.wormgine.game_stage",
    );
    const configEvent = stateEvents.find(
      (s) => s.type === "uk.half-shot.uk.wormgine.game_config",
    ) as unknown as GameConfigEvent;
    if (createEvent?.content.type !== WormgineRoomType) {
      throw Error("Room is not a wormgine room");
    }
    const gameStage = stageEvent?.content.stage as GameStage;
    // TODO: Test that this value is correct.
    if (!gameStage) {
      throw Error("Unknown game stage, cannot continue");
    }
    return new NetGameInstance(roomId, this, {
      // Should be forced in start()
      myUserId: this.client.getUserId()!,
      hostUserId: createEvent.sender,
      // TODO: How to figure this out?
      members: Object.fromEntries(
        stateEvents
          .filter(
            (m) =>
              m.type === "m.room.member" && m.content.membership === "join",
          )
          .map((m) => [m.state_key, m.content.displayname ?? m.state_key]),
      ),
      stage: gameStage,
      teams: Object.fromEntries(
        stateEvents
          .filter(
            (m) =>
              m.type === GameProposedTeamEventType &&
              Object.keys(m.content).length > 0,
          )
          .map((m) => [m.state_key, m.content as ProposedTeam]),
      ),
      rules: configEvent.content.rules,
    });
  }
}
