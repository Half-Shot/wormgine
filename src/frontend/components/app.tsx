import { useCallback, useEffect, useState } from "preact/hooks";
import { IngameView } from "./ingame-view";
import Menu from "./menu";
import { NetClientConfig, NetGameClient } from "../../net/client";
import { GameReactChannel } from "../../interop/gamechannel";
import type { AssetData } from "../../assets/manifest";
import { getClientConfigHook, useGameSettingsHook } from "../../settings";
import { MotionConfig } from "framer-motion";
import {
  IRunningGameInstance,
  LocalGameInstance,
} from "../../logic/gameinstance";
import Logger from "../../log";

const log = new Logger("App");

interface LoadGameProps {
  scenario: string;
  level?: string;
  gameInstance: IRunningGameInstance;
}

export function App() {
  const [gameState, setGameState] = useState<LoadGameProps>();
  const [client, setClient] = useState<NetGameClient>();
  const [clientConfig, setClientConfig, { removeItem: removeClientConfig }] =
    getClientConfigHook();
  const gameReactChannel = new GameReactChannel();

  const [lobbyGameRoomId, setLobbyGameRoomId] = useState<string>();
  const [settings] = useGameSettingsHook();
  useEffect(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const gId = parameters.get("gameRoomId");
    const preStateConfig = parameters.get("stateConfig");
    if (gId) {
      setLobbyGameRoomId(gId);
    } else if (preStateConfig) {
      const [scenario, level] = preStateConfig.split(";");
      const gameInstance = new LocalGameInstance();
      gameInstance.startGame();
      setGameState({
        scenario,
        level,
        gameInstance,
      });
    }
  }, []);

  useEffect(() => {
    if (!clientConfig) {
      return;
    }

    void (async () => {
      try {
        const client = new NetGameClient(clientConfig);
        void client.start();
        setClient(client);
      } catch (ex) {
        log.error("Failed to connect to game server", ex);
      }
    });

    return () => client?.stop();
  }, [clientConfig]);

  gameReactChannel.on("goToMenu", () => {
    // TODO: Show a win screen!
    setGameState(undefined);
  });

  const onNewGame = useCallback(
    (
      scenario: string,
      gameInstance: IRunningGameInstance,
      level?: keyof AssetData,
    ) => {
      setGameState({ scenario, level, gameInstance });
    },
    [setGameState],
  );
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

  let root = null;
  if (gameState) {
    root = (
      <IngameView
        scenario={gameState.scenario}
        level={gameState.level}
        gameReactChannel={gameReactChannel}
        gameInstance={gameState.gameInstance}
      />
    );
  } else {
    root = (
      <Menu
        onNewGame={onNewGame}
        setClientConfig={setConfig}
        lobbyGameRoomId={lobbyGameRoomId}
        client={client}
      />
    );
  }

  return (
    <MotionConfig reducedMotion={settings.reduceMotion ? "always" : "user"}>
      {root}
    </MotionConfig>
  );
}
