import { createClient, MatrixClient } from "matrix-js-sdk";
import { FullGameStateEvent } from "./models";

export class NetgameClient {
    private readonly client: MatrixClient;

    public static async register(homeserverUrl: string, name: string, password: string) {
        const client = createClient({
            baseUrl: homeserverUrl,
        });
        return await client.register(name, password, null, { type: "m.login.password"});
    }

    constructor(homeserverUrl: string, public accessToken: string) {
        this.client = createClient({
            baseUrl: homeserverUrl,
            accessToken: accessToken,
        });
    }

    public async setDisplayname(name: string): Promise<void> {
        await this.client.setDisplayName(name);
    }

    public async createGameRoom(): Promise<string> {
        return "!room:id";
    }

    public async joinGameRoom(roomId: string): Promise<void> {
        
    }

    public async sendLoaded(roomId: string): Promise<void> {

    }

    public async sendAck(roomId: string): Promise<void> {

    }

    public async sendFullGameState(roomId: string, state: FullGameStateEvent["content"]): Promise<void> {

    }

    public async sendBitmap(roomId: string, bitmap: Buffer): Promise<void> {

    }
}