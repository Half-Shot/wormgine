import {
  GameStageEvent,
  GameConfigEvent,
  GameStageEventType,
  GameConfigEventType,
  GameProposedTeamEventType,
} from "./models";
import { EventEmitter } from "pixi.js";
import {
  ClientEvent,
  createClient,
  MatrixClient,
  MatrixError,
  MemoryStore,
  Preset,
  RoomEvent,
  SyncState,
  Visibility,
} from "matrix-js-sdk";
import { BehaviorSubject } from "rxjs";
import Logger from "../log";
import { WORMGINE_STORAGE_KEY_CLIENT_CONFIG } from "../settings";
import { GameStage, ProposedTeam } from "../logic/gameinstance";
import { NetGameInstance, RunningNetGameInstance } from "./netgameinstance";
import { GameRules } from "../logic/gamestate";
import { getAssets } from "../assets";
import { ScenarioBuilder } from "../levels/scenarioParser";

const logger = new Logger("NetClient");

export interface NetClientConfig {
  baseUrl: string;
  accessToken: string;
}

export enum ClientState {
  NotAuthenticated,
  Connecting,
  Connected,
  AuthenticationError,
  OfflineError,
  UnknownError,
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

  public static async register(
    homeserverUrl: string,
    registrationToken: string,
    username: string,
    password: string,
  ): Promise<{ accessToken: string }> {
    const client = createClient({
      baseUrl: homeserverUrl,
      fetchFn: (input, init) => globalThis.fetch(input, init),
      store: new MemoryStore({ localStorage: window.localStorage }),
    });
    const params: { session: string; flows: { stages: string[] }[] } =
      await client.registerRequest({}).catch((ex) => ex.data);
    if (
      !params.flows.some((s) => s.stages[0] === "m.login.registration_token")
    ) {
      throw Error(
        "Cannot register on this host. Registration token support is not enabled",
      );
    }
    try {
      const response = await client.register(
        username,
        password,
        params.session,
        {
          type: "m.login.registration_token",
          token: registrationToken,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      );
      if (!response.access_token) {
        throw Error("Unexpected response");
      }
      return { accessToken: response.access_token };
    } catch (ex) {
      if (
        (ex as MatrixError).data.completed?.includes(
          "m.login.registration_token",
        )
      ) {
        const response = await client.register(
          username,
          password,
          params.session,
          {
            type: "m.login.dummy",
          },
        );
        if (!response.access_token) {
          throw Error("Unexpected response");
        }
        return { accessToken: response.access_token };
      } else {
        throw ex;
      }
    }
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
      logger.error("Unexpected sync error", err);
    });
    this.clientState.next(ClientState.Connecting);
    await this.client.startClient();
  }

  public async setDisplayname(name: string): Promise<void> {
    await this.client.setDisplayName(name);
  }

  public async createGameRoom(rules: GameRules): Promise<string> {
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
            type: "uk.half-shot.wormgine.game_config",
            content: {
              rules,
              teams: [],
            },
          } satisfies GameConfigEvent,
        ],
      })
    ).room_id;
  }

  public async joinGameRoom(roomId: string): Promise<NetGameInstance> {
    // TODO: Check game room is a real game room.
    const room = await this.client.joinRoom(roomId);
    // XXX: Synapse tends to lie and say the room doesn't exist.
    let stateEvents;
    try {
      stateEvents = await this.client.roomState(roomId);
    } catch {
      // TODO: Timeout.
      await new Promise<void>((r) =>
        room.on(RoomEvent.MyMembership, () => r()),
      );
      stateEvents = await this.client.roomState(roomId);
    }

    const createEvent = stateEvents.find((s) => s.type === "m.room.create");
    const stageEvent = stateEvents.find((s) => s.type === GameStageEventType);
    const configEvent = stateEvents.find(
      (s) => s.type === GameConfigEventType,
    ) as unknown as GameConfigEvent;
    if (createEvent?.content.type !== WormgineRoomType) {
      throw Error("Room is not a wormgine room");
    }
    const gameStage = stageEvent?.content.stage as GameStage;
    // TODO: Test that this value is correct.
    if (!gameStage) {
      throw Error("Unknown game stage, cannot continue");
    }

    const initialConfig = {
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
      level: configEvent.content.level && {
        mapName: configEvent.content.level.name,
        levelMxc: configEvent.content.level.data_mxc,
        terrainMxc: configEvent.content.level.bitmap_mxc,
      },
    };

    if (gameStage === GameStage.InProgress) {
      const configEvent = stateEvents.find(
        (s) => s.type === GameConfigEventType,
      ) as unknown as GameConfigEvent;
      if (!configEvent) {
        throw Error("In progress game had no state");
      }

      if (!configEvent.content.level) {
        throw Error("Missing required level content");
      }

      const bitmapMxc = await this.downloadMedia(
        configEvent.content.level.bitmap_mxc,
      );
      const dataBlob = await this.downloadMedia(
        configEvent.content.level.data_mxc,
      );

      const assets = getAssets();
      const scenario = (
        await (
          await ScenarioBuilder.fromBlob(dataBlob, assets.data)
        ).loadBitmapFromBlob(bitmapMxc)
      ).parse();

      return new RunningNetGameInstance(
        room,
        this,
        initialConfig,
        configEvent["content"],
        scenario,
      );
    }

    return new NetGameInstance(room, this, initialConfig);
  }

  public async uploadMedia(data: Blob): Promise<string> {
    const req = await this.client.uploadContent(data);
    return req.content_uri;
  }

  public async downloadMedia(
    ...params: Parameters<MatrixClient["mxcUrlToHttp"]>
  ): Promise<Blob> {
    params[6] = true;
    const url = this.client.mxcUrlToHttp(...params);
    if (!url) {
      throw Error(`Could not generate HTTP url for ${params[0]}`);
    }
    const req = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.client.getAccessToken()}`,
      },
    });
    if (!req.ok) {
      throw Error("Failed to load media");
    }
    return req.blob();
  }
}
