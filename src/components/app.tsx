import { useCallback, useEffect, useState } from "preact/hooks";
import { IngameView } from "./ingame-view";
import { Menu } from "./menu";
import { loadAssets } from "../assets";
import { NetGameClient, NetGameInstance } from "../net/client";
import { Lobby } from "./lobby";
import { GameReactChannel } from "../interop/gamechannel";

interface LoadGameProps {
    level: string;
    gameInstance?: NetGameInstance;
}


export function App() {
    const [gameState, setGameState] = useState<LoadGameProps>();
    const [assetProgress, setAssetProgress] = useState(0);
    const [assetsLoaded, setAssetsLoaded] = useState(false);
    const [showLobby, setShowLobby] = useState(false);
    const [client, setClient]= useState<NetGameClient>();
    const lobbyGameRoomId = new URLSearchParams(window.location.search)?.get('gameRoomId') ?? undefined;
    const [clientReady, setClientReady] = useState(client?.ready);
    const [clientShouldReload, setClientShouldReload] = useState(true);
    const gameReactChannel = new GameReactChannel();

    useEffect(() => {
        if (!clientShouldReload) {
            return;
        }
        if (client) {
            return;
        }
        setClientShouldReload(false);
        // Load client.
        const configStr = localStorage.getItem('wormgine_client_config');
        if (configStr) {
            const client = new NetGameClient(JSON.parse(configStr));
            client.once('sync', () => {
                setClientReady(true);
            });
            setClient(client);
            client.start();
        }
    }, [clientShouldReload]);

    gameReactChannel.on('goToMenu', () => {
        // TODO: Show a win screen!
        setGameState(undefined);
    });

    useEffect(() => {
        void loadAssets((v) => { setAssetProgress(v) }).then(() => setAssetsLoaded(true));
    }, [setAssetProgress]);

    useEffect(() => {
        if (client && lobbyGameRoomId && clientReady && !gameState) {
            // Now we can load into the game.
            setShowLobby(true);
        }
    })

    const onNewGame = useCallback((level: string) => {
        if (level === 'lobbyGame') {
            // TODO: Bit of a hack
            setShowLobby(true);
        } else {
            setGameState({level});
        }
    }, [setGameState]);
 
    const onLobbyGameStarted = useCallback((instance: NetGameInstance) => {
        setGameState({level: 'netGame', gameInstance: instance});
        setShowLobby(false);
    }, [setGameState]);
 
    if (!assetsLoaded) {
        return <main>
            Loading <progress value={assetProgress*100} min={0} max={100}></progress> {Math.round(assetProgress*100)}%
        </main>;
    }

    if (lobbyGameRoomId && !clientReady) {
        return <main>
            Waiting for client to be ready.
        </main>;
    }

    if (showLobby) {
        return <Lobby client={client} gameRoomId={lobbyGameRoomId} onOpenIngame={onLobbyGameStarted}/>
    }

    if (gameState) {
        return <IngameView level={gameState.level} gameReactChannel={gameReactChannel} gameInstance={gameState.gameInstance}/>
    }


    return <Menu onNewGame={onNewGame} reloadClient={() => setClientShouldReload(true)} client={client}/>
}