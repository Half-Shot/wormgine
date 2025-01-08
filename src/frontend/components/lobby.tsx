import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { NetGameClient, NetGameInstance } from "../../net/client";
import { GameStage } from "../../net/models";
import { TeamGroup } from "../../logic/teams";
import Logger from "../../log";

const logger = new Logger("Lobby");

interface Props {
  client?: NetGameClient;
  onOpenIngame: (gameInstance: NetGameInstance) => void;
  gameRoomId?: string;
}

export function Lobby({
  client,
  gameRoomId: initialGameRoomId,
  onOpenIngame,
}: Props) {
  const [gameRoomId, setGameRoomId] = useState<string | undefined>(
    initialGameRoomId,
  );
  const [error, setError] = useState<string>();
  const [gameInstance, setGameInstance] = useState<NetGameInstance>();

  const lobbyLink = useMemo(
    () =>
      gameRoomId &&
      `${window.location.origin}${window.location.pathname}?gameRoomId=${encodeURIComponent(gameRoomId)}`,
    [gameRoomId],
  );

  const createGameCallback = useCallback(() => {
    if (!client) {
      throw Error("No client in lobby screen!");
    }
    client
      .createGameRoom({
        rules: {
          winWhenOneGroupRemains: true,
        },
        teams: [
          {
            name: "Foobars",
            group: TeamGroup.Red,
            playerUserId: client.client.getUserId(),
            worms: [
              {
                name: "Rev",
                health: 100,
                maxHealth: 100,
              },
            ],
            ammo: {},
          },
        ],
      })
      .then((roomId) => setGameRoomId(roomId))
      .catch((ex) => {
        setError("Failed to create new game!");
        // This should show a proper error
        console.error("Failed to create game", ex);
      });
  }, [client]);

  useEffect(() => {
    if (!gameRoomId) {
      return;
    }
    if (gameInstance) {
      return;
    }
    if (!client) {
      throw Error("No client in lobby screen!");
    }
    logger.info("Loading game instance", gameRoomId);
    client
      .joinGameRoom(gameRoomId)
      .then((instance) => {
        setGameInstance(instance);
      })
      .catch((ex) => {
        logger.error("Failed to load game", ex);
        setError("Failed load existing game!");
      });
  }, [gameRoomId, gameInstance, client]);

  const startGame = useCallback(async () => {
    if (!gameInstance) {
      throw Error("Must have a game instance");
    }
    try {
      await gameInstance.startGame();
      onOpenIngame(gameInstance);
    } catch (ex) {
      logger.error("Failed to start game", ex);
      setError("Failed to start game!");
    }
  }, [gameInstance]);

  if (!gameInstance) {
    if (!gameRoomId) {
      return (
        <main className="menu">
          <h1>Game Lobby</h1>
          {error && <p className="error">{error}</p>}
          <p>This area is the staging area for a new networked game.</p>
          <button onClick={createGameCallback} disabled={!!gameRoomId}>
            Create new Game
          </button>
        </main>
      );
    } else {
      return (
        <main className="menu">
          <h1>Game Lobby</h1>
          {error && <p className="error">{error}</p>}
          <p>Loading lobby...</p>
        </main>
      );
    }
  }

  // TODO: Boot them straight to the game?
  if (gameInstance.stage !== GameStage.Lobby) {
    return (
      <main className="menu">
        <h1>Game Lobby</h1>
        <p className="error">Game is already in progress</p>
      </main>
    );
  }

  return (
    <main className="menu">
      <h1>Game Lobby</h1>
      {error && <p className="error">{error}</p>}
      <p>This area is the staging area for a new networked game.</p>
      <p>
        You can invite players by sending them a link to{" "}
        <a href={lobbyLink}>{lobbyLink}</a>.
      </p>
      <ul>
        {Object.entries(gameInstance.members).map(([userId, displayname]) => {
          return (
            <li>
              {displayname}{" "}
              {userId === gameInstance.hostUserId ? (
                <span title="Host">🌟</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <button onClick={startGame} disabled={!gameInstance.isHost}>
        Start Game
      </button>
    </main>
  );
}
