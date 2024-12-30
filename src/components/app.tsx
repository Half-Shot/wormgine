import { useCallback, useEffect, useState } from "preact/hooks";
import { IngameView } from "./ingame-view";
import { Menu } from "./menu";
import { loadAssets } from "../assets";
import { NetGameClient, NetGameInstance } from "../net/client";
import { Lobby } from "./lobby";
import { GameReactChannel } from "../interop/gamechannel";
import type { AssetData } from "../assets/manifest";

interface LoadGameProps {
  scenario: string;
  level?: string;
  gameInstance?: NetGameInstance;
}

export function App() {
  const [gameState, setGameState] = useState<LoadGameProps>();
  const [assetProgress, setAssetProgress] = useState(0);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [showLobby, setShowLobby] = useState(false);
  const [client, setClient] = useState<NetGameClient>();
  const [clientReady, setClientReady] = useState(client?.ready);
  const [clientShouldReload, setClientShouldReload] = useState(true);
  const gameReactChannel = new GameReactChannel();

  const [lobbyGameRoomId, setLobbyGameRoomId] = useState<string>();

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const gId = parameters.get("gameRoomId");
    const preStateConfig = parameters.get("stateConfig");
    if (gId) {
      setLobbyGameRoomId(gId);
    }
    if (preStateConfig) {
      const [scenario, level] = preStateConfig.split(";");
      setGameState({
        scenario,
        level,
      });
    }
  }, []);

  useEffect(() => {
    if (!clientShouldReload) {
      return;
    }
    if (client) {
      return;
    }
    setClientShouldReload(false);
    // Load client.
    const configStr = localStorage.getItem("wormgine_client_config");
    if (configStr) {
      const client = new NetGameClient(JSON.parse(configStr));
      client.once("sync", () => {
        setClientReady(true);
      });
      setClient(client);
      client.start();
    }
  }, [clientShouldReload]);

  gameReactChannel.on("goToMenu", () => {
    // TODO: Show a win screen!
    setGameState(undefined);
  });

  useEffect(() => {
    void loadAssets((v) => {
      setAssetProgress(v);
    }).then(() => setAssetsLoaded(true));
  }, [setAssetProgress]);

  useEffect(() => {
    if (client && lobbyGameRoomId && clientReady && !gameState) {
      // Now we can load into the game.
      setShowLobby(true);
    }
  });

  const onNewGame = useCallback(
    (scenario: string, level?: keyof AssetData) => {
      if (scenario === "lobbyGame") {
        // TODO: Bit of a hack
        setShowLobby(true);
      } else {
        setGameState({ scenario, level });
      }
    },
    [setGameState],
  );

  const onLobbyGameStarted = useCallback(
    (instance: NetGameInstance) => {
      setGameState({ scenario: "netGame", gameInstance: instance });
      setShowLobby(false);
    },
    [setGameState],
  );

  if (!assetsLoaded) {
    return (
      <main>
        Loading{" "}
        <progress value={assetProgress * 100} min={0} max={100}></progress>{" "}
        {Math.round(assetProgress * 100)}%
      </main>
    );
  }

  if (lobbyGameRoomId && !clientReady) {
    return <main>Waiting for client to be ready.</main>;
  }

  if (showLobby) {
    return (
      <Lobby
        client={client}
        gameRoomId={lobbyGameRoomId}
        onOpenIngame={onLobbyGameStarted}
      />
    );
  }

  if (gameState) {
    return (
      <IngameView
        scenario={gameState.scenario}
        level={gameState.level}
        gameReactChannel={gameReactChannel}
        gameInstance={gameState.gameInstance}
      />
    );
  }

  return (
    <Menu
      onNewGame={onNewGame}
      reloadClient={() => setClientShouldReload(true)}
      client={client}
    />
  );
}
