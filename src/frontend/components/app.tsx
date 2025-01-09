import { useCallback, useEffect, useState } from "preact/hooks";
import { IngameView } from "./ingame-view";
import { Menu } from "./menu";
import { assetLoadPercentage, assetsAreReady } from "../../assets";
import {
  ClientState,
  NetClientConfig,
  NetGameClient,
  NetGameInstance,
} from "../../net/client";
import { GameReactChannel } from "../../interop/gamechannel";
import type { AssetData } from "../../assets/manifest";
import { useObservableEagerState } from "observable-hooks";
import { map, of } from "rxjs";
import { getClientConfigHook } from "../../settings";

interface LoadGameProps {
  scenario: string;
  level?: string;
  gameInstance?: NetGameInstance;
}

export function App() {
  const [gameState, setGameState] = useState<LoadGameProps>();
  const assetProgress = useObservableEagerState(assetLoadPercentage);
  const assetsLoaded = useObservableEagerState(assetsAreReady);
  const [client, setClient] = useState<NetGameClient>();
  const [clientConfig, setClientConfig, { removeItem: removeClientConfig }] =
    getClientConfigHook();
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
    if (!clientConfig) {
      return;
    }
    const client = new NetGameClient(clientConfig);
    setClient(client);
    void client.start();

    return () => client.stop();
  }, [clientConfig]);

  gameReactChannel.on("goToMenu", () => {
    // TODO: Show a win screen!
    setGameState(undefined);
  });

  const onNewGame = useCallback(
    (
      scenario: string,
      gameInstance: NetGameInstance | undefined,
      level?: keyof AssetData,
    ) => {
      setGameState({ scenario, level, gameInstance });
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

  const setConfig = useCallback(
    (v: NetClientConfig | null) => {
      if (v) {
        setClientConfig(v);
      } else {
        removeClientConfig();
      }
    },
    [setClientConfig],
  );

  return (
    <Menu
      onNewGame={onNewGame}
      setClientConfig={setConfig}
      lobbyGameRoomId={lobbyGameRoomId}
      client={client}
    />
  );
}
