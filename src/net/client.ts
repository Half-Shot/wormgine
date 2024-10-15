

import { FullGameStageEvent, GameStage, PlayerAckEvent } from "./models";
import { EventEmitter } from "pixi.js";
import { StateRecordLine } from "../state/model";
import { ClientEvent, createClient, MatrixClient, MemoryStore, Preset, Room, RoomEvent, Visibility } from "matrix-js-sdk";

export interface NetClientConfig {
    baseUrl: string,
    accessToken: string,
}

interface NetGameConfiguration {
    myUserId: string,
    hostUserId: string,
    members: Record<string, string>,
    stage: GameStage,
}

export class NetGameInstance {
    private _members: Record<string, string>;
    public readonly hostUserId: string;
    public readonly isHost: boolean;
    private _stage: GameStage;
    private room: Room;

    public get members() {
        return {...this._members};
    }

    public get stage() {
        return this._stage;
    }

    constructor(private readonly roomId: string, private readonly client: NetGameClient, initialConfiguration: NetGameConfiguration) {
        this.hostUserId = initialConfiguration.hostUserId;
        this.isHost = initialConfiguration.hostUserId === initialConfiguration.myUserId;
        // TODO: Auto update on new members
        this._members = initialConfiguration.members;
        this._stage = initialConfiguration.stage;
        this.room = this.client.client.getRoom(roomId)!;
        if (!this.room) {
            throw Error('Room not found');
        }
    }

    public async startGame() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.client.client.sendStateEvent(this.roomId, 'uk.half-shot.uk.wormgine.game_stage' as any, {
            stage: GameStage.InProgress,
        } satisfies FullGameStageEvent["content"]);
    }

    public async sendAck() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.client.client.sendEvent(this.roomId, 'uk.half-shot.uk.wormgine.ack' as any, {
            ack: true,
        } satisfies PlayerAckEvent["content"]);
    }

    public async sendGameState(data: Record<string, unknown>) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.client.client.sendEvent(this.roomId, 'uk.half-shot.wormgine.game_state' as any, data);
    }

    public subscribeToGameState(_fn: (data: StateRecordLine<unknown>) => void) {
        throw Error('Not implemented');
        this.room.on(RoomEvent.TimelineRefresh, (_room, timelineSet) => {
            console.log(timelineSet.getLiveTimeline().getEvents());
        });
    }
}

const WormgineRoomType = "uk.half-shot.wormgine.v1";

export class NetGameClient extends EventEmitter {
    public readonly client: MatrixClient;

    public static async register(homeserverUrl: string, name: string, password: string) {
        const client = createClient({
            baseUrl: homeserverUrl,
            fetchFn: (input, init) => globalThis.fetch(input, init),
        });
        return await client.register(name, password, null, { type: "m.login.password"});
    }
    public static async login(homeserverUrl: string, username: string, password: string): Promise<{ accessToken: string; }> {
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
    }

    public get ready() {
        return this.client.isInitialSyncComplete();
    }

    public async start() {
        const whoami = await this.client.whoami();
        this.client.credentials.userId = whoami.user_id;
        this.client.deviceId = whoami.device_id ?? null;
        this.client.addListener(ClientEvent.Sync, () => {
            this.emit('sync');
        })
        await this.client.startClient();
    }

    public async setDisplayname(name: string): Promise<void> {
        await this.client.setDisplayName(name);
    }

    public async createGameRoom(): Promise<string> {
        return (await this.client.createRoom({
            name: `Wormtrix ${new Date().toUTCString()}`,
            preset: Preset.PublicChat,
            visibility: Visibility.Private,
            creation_content: {
                type: WormgineRoomType
            },
            initial_state: [{
                state_key: "", type: "uk.half-shot.uk.wormgine.game_stage", content: { stage: GameStage.Lobby }
            } satisfies FullGameStageEvent]
        })).room_id;
    }

    public async joinGameRoom(roomId: string): Promise<NetGameInstance> {
        // TODO: Check game room is a real game room.
        await this.client.joinRoom(roomId);
        const stateEvents = await this.client.roomState(roomId);
        const createEvent = stateEvents.find(s => s.type === "m.room.create");
        const stageEvent = stateEvents.find(s => s.type === "uk.half-shot.uk.wormgine.game_stage");
        if (createEvent?.content.type !== WormgineRoomType) {
            throw Error('Room is not a wormgine room');
        }
        const gameStage = stageEvent?.content.stage as GameStage;
        // TODO: Test that this value is correct.
        if (!gameStage) {
            throw Error('Unknown game stage, cannot continue');
        }
        return new NetGameInstance(roomId, this, {
            // Should be forced in start()
            myUserId: this.client.getUserId()!,
            hostUserId: createEvent.sender,
            // TODO: How to figure this out?
            members: Object.fromEntries(stateEvents.filter(m => m.type === "m.room.member" && m.content.membership === "join").map(m => [m.state_key, m.content.displayname ?? m.state_key])),
            stage: gameStage,
        })
    }
}