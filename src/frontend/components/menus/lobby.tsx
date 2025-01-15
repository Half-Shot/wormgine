import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import {
  ClientState,
  NetGameClient,
  NetGameInstance,
  RunningNetGameInstance,
} from "../../../net/client";
import { GameStage, ProposedTeam } from "../../../net/models";
import Logger from "../../../log";
import { useObservableEagerState } from "observable-hooks";
import useLocalStorageState from "use-local-storage-state";
import { StoredTeam, WORMGINE_STORAGE_KEY_TEAMS } from "../../../settings";
import styles from "./lobby.module.css";
import { TeamGroup } from "../../../logic/teams";

const logger = new Logger("Lobby");

const MAX_WORMS = 8;

interface Props {
  client: NetGameClient;
  onOpenIngame: (gameInstance: RunningNetGameInstance) => void;
  exitToMenu: () => void;
  gameRoomId: string;
}

export function TeamEntry({
  playerName,
  team,
  changeTeamColor,
  onRemoveTeam,
  incrementWormCount,
}: {
  playerName: string;
  team: ProposedTeam;
  onRemoveTeam?: () => void;
  incrementWormCount?: () => void;
  changeTeamColor?: () => void;
}) {
  const color = `var(--team-${TeamGroup[team.group].toLocaleLowerCase()}-fg)`;
  const backgroundColor = `var(--team-${TeamGroup[team.group].toLocaleLowerCase()}-fg)`;
  return (
    <div style={{ color }} className={styles.teamEntry}>
    <button className={styles.removeTeam} onClick={onRemoveTeam}>
      X
    </button>
    <button
      className={styles.wormCount}
      onClick={incrementWormCount}
      disabled={!incrementWormCount}
    >
      <ul>
        {Array.from({ length: team.wormCount }).map(() => (
          <li>o</li>
        ))}
      </ul>
    </button>
      <button
        onClick={changeTeamColor}
        disabled={!changeTeamColor}
        style={{ color, backgroundColor }}
        className={styles.teamColor}
      />
      <span>{team.name}</span>
      <span className={styles.playerName}>({playerName})</span>
    </div>
  );
}

export function TeamPicker({ gameInstance, proposedTeams }: { gameInstance: NetGameInstance, proposedTeams: ProposedTeam[] }) {
  const membersMap = useObservableEagerState(gameInstance.members);
  // @ts-ignore
  const nextTeamGroup: TeamGroup = TeamGroup[useMemo(() => Object.values(TeamGroup).find(v => !proposedTeams.some(t => t.group === v)) as string ?? TeamGroup.Red, [proposedTeams])];
  const [storedLocalTeams] = useLocalStorageState<StoredTeam[]>(
    WORMGINE_STORAGE_KEY_TEAMS,
    { defaultValue: [] },
  );
  const localTeams = useMemo(
    () =>
      storedLocalTeams.filter(
        (t) => !proposedTeams.some((o) => o.name === t.name),
      ),
    [proposedTeams, storedLocalTeams],
  );

  const addTeam = useCallback(
    (_evt: MouseEvent, team: StoredTeam) => {
      gameInstance.addProposedTeam(team, MAX_WORMS, nextTeamGroup).catch((ex) => {
        logger.warning("Failed to add team", team, ex);
      });
    },
    [gameInstance],
  );

  const removeTeam = useCallback(
    (team: ProposedTeam) => {
      gameInstance.removeProposedTeam(team).catch((ex) => {
        logger.warning("Failed to add team", team, ex);
      });
    },
    [gameInstance],
  );


  return <section>
  <h2>Teams</h2>
  <div className={styles.teamBox}>
    <div className={styles.localTeams}>
      <h3>Your teams</h3>
      <ol>
        {localTeams.length > 0 ? (
          localTeams.map((t) => (
            <li key={t.uuid}>
              <button className={styles.teamButton}  onClick={(evt) => addTeam(evt, t)}>{t.name}</button>
            </li>
          ))
        ) : (storedLocalTeams.length === 0 ? <p> You have no teams </p> : null)}
      </ol>
    </div>
    <div>
      <h3>In-play</h3>
      <ol>
      {proposedTeams.map((t) => {
          const canAlter =
            gameInstance.isHost ||
            t.playerUserId === gameInstance.myUserId;
          if (!canAlter) {
            return (
              <li key={t.uuid}>
                <TeamEntry
                  team={t}
                  playerName={membersMap[t.playerUserId]}
                ></TeamEntry>
              </li>
            );
          }
          const onRemoveTeam = () => removeTeam(t);
          const incrementWormCount = () => {
            const wormCount =
              t.wormCount >= MAX_WORMS ? 1 : t.wormCount + 1;
            gameInstance.updateProposedTeam(t, { wormCount });
          };
          const changeTeamColor = () => {
            let teamGroup = t.group + 1;
            if (TeamGroup[teamGroup] === undefined) {
              teamGroup = TeamGroup.Red;
            }
            gameInstance.updateProposedTeam(t, { teamGroup });
          };
          return (
            <li key={t.name}>
              <TeamEntry
                onRemoveTeam={onRemoveTeam}
                incrementWormCount={incrementWormCount}
                changeTeamColor={changeTeamColor}
                team={t}
                playerName={membersMap[t.playerUserId]}
              ></TeamEntry>
            </li>
          );
        })}
        </ol>
    </div>
  </div>
</section>;
}

export function ActiveLobby({
  gameInstance,
  onOpenIngame,
  exitToMenu,
}: {
  gameInstance: NetGameInstance;
  onOpenIngame: () => void;
  exitToMenu: () => void;
}) {
  const [error, setError] = useState<string>();

  const membersMap = useObservableEagerState(gameInstance.members);
  const members = useMemo(
    () =>
      Object.entries(membersMap).sort(([uA], [uB]) =>
        [uA, uB].sort().indexOf(uA),
      ),
    [membersMap],
  );
  const proposedTeams = useObservableEagerState(gameInstance.proposedTeams);

  const viableToStart = useMemo(() =>
    gameInstance.isHost &&
    members.length >= 2 &&
    proposedTeams.length >= 2 &&
      Object.keys(proposedTeams.reduce<Partial<Record<TeamGroup, number>>>((v, o) => ({
        ...v,
      [o.group]: (v[o.group] ?? 0) + 1
    }), { })).length >= 2
  , [gameInstance, members, proposedTeams]);

  const lobbyLink = `${window.location.origin}${window.location.pathname}?gameRoomId=${encodeURIComponent(gameInstance.roomId)}`;
  return (
    <>
      {error && <p className="error">{error}</p>}
      <p>This area is the staging area for a new networked game.</p>
      <p>
        You can invite players by sending them a link to{" "}
        <a href={lobbyLink}>{lobbyLink}</a>.
      </p>
      <section>
        <h2>Players</h2>
        <ul>
          {members.map(([userId, displayname]) => {
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
      </section>

      <TeamPicker gameInstance={gameInstance} proposedTeams={proposedTeams}/>

      <section>
        <button onClick={() => onOpenIngame()} disabled={!viableToStart}>
          Start Game
        </button>
        <button onClick={() => exitToMenu()} disabled={gameInstance.isHost}>
          Exit Lobby
        </button>
      </section>
    </>
  );
}

export function Lobby({ client, gameRoomId, onOpenIngame, exitToMenu }: Props) {
  const [error, setError] = useState<string>();
  const [gameInstance, setGameInstance] = useState<NetGameInstance>();

  const clientState = useObservableEagerState(client.state);

  useEffect(() => {
    if (!gameInstance) {
      return;
    }
    const s = gameInstance.stage.subscribe((v) => {
      if (v === GameStage.InProgress) {
        logger.info("Game is in progress");
        if (gameInstance instanceof RunningNetGameInstance) {
          logger.debug("Using existing game instance");
          onOpenIngame(gameInstance);
        } else {
          // Inefficient
          client.joinGameRoom(gameInstance.roomId).then((running) => {
            onOpenIngame(running as RunningNetGameInstance);
          });
        }
      }
    });
    return () => s.unsubscribe();
  }, [gameInstance]);

  useEffect(() => {
    if (clientState !== ClientState.Connected) {
      return;
    }
    if (gameInstance) {
      return;
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
  }, [clientState, gameRoomId, gameInstance, client]);

  const startGame = useCallback(async () => {
    if (!gameInstance) {
      throw Error("Must have a game instance");
    }
    try {
      await gameInstance.startGame();
    } catch (ex) {
      logger.error("Failed to start game", ex);
      setError("Failed to start game!");
    }
  }, [gameInstance]);

  const exitLobby = useCallback(async () => {
    if (!gameInstance) {
      throw Error("Must have a game instance");
    }
    try {
      await gameInstance.exitGame();
      exitToMenu();
    } catch (ex) {
      logger.error("Failed to exit game", ex);
      setError("Failed to exit game!");
    }
  }, [exitToMenu, gameInstance]);

  if (
    clientState !== ClientState.Connecting &&
    clientState !== ClientState.Connected
  ) {
    return <p>Client error</p>;
  } else if (clientState !== ClientState.Connected) {
    return <p>Waiting for client to be ready...</p>;
  }
  if (error) {
    return <p className="error">{error}</p>;
  }

  if (!gameInstance) {
    return (
      <>
        {error && <p className="error">{error}</p>}
        <p>Loading lobby...</p>
      </>
    );
  }

  return (
    <ActiveLobby
      gameInstance={gameInstance}
      onOpenIngame={startGame}
      exitToMenu={exitLobby}
    />
  );
}
