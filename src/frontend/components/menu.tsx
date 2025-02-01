import { useCallback, useEffect, useState } from "preact/hooks";
import { ChangelogModal } from "./changelog";
import styles from "./menu.module.css";
import { NetClientConfig, NetGameClient } from "../../net/client";
import { GameMenu } from "./menus/types";
import OnlinePlayMenu from "./menus/online-play";
import { OverlayTest } from "./menus/overlaytest";
import type { AssetData } from "../../assets/manifest";
import TeamEditorMenu from "./menus/team-editor";
import SettingsMenu from "./menus/settings";
import MenuHeader from "./atoms/menu-header";
import { Lobby } from "./menus/lobby";
import { motion, AnimatePresence } from "framer-motion";
import { ComponentChildren } from "preact";
import { IRunningGameInstance } from "../../logic/gameinstance";

interface Props {
  onNewGame: (
    scenario: string,
    gameInstance: IRunningGameInstance,
    level?: keyof AssetData,
  ) => void;
  setClientConfig: (config: NetClientConfig | null) => void;
  client?: NetGameClient;
  lobbyGameRoomId?: string;
}

const buildNumber = import.meta.env.VITE_BUILD_NUMBER;
const buildCommit = import.meta.env.VITE_BUILD_COMMIT;
const lastCommit = localStorage.getItem("wormgine_last_commit");

function SubMenu(props: {
  key: string | GameMenu;
  children: ComponentChildren;
}) {
  return (
    <motion.div
      className="box"
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
    >
      <div className={styles.menu}>
        <menu key={props.key} >
          {props.children}
        </menu>
      </div>
    </motion.div>
  );
}

function mainMenu(
  onLocalGame: () => void,
  setCurrentMenu: (menu: GameMenu) => void,
) {
  return (
    <SubMenu key="main-menu">
      <h1>Kobold Kombat</h1>
      <p className={styles.betaWarning}>
        The game is still in heavy development, this site is updated with the
        latest builds automatically.
        <ChangelogModal
          buildNumber={buildNumber}
          buildCommit={buildCommit}
          lastCommit={lastCommit}
        />
      </p>
      <ul className={styles.levelPicker}>
        <li>
          <button onClick={() => onLocalGame()}>Skirmish</button>
        </li>
        <li>
          <button disabled>Missions</button>
        </li>
        <li>
          <button onClick={() => setCurrentMenu(GameMenu.TeamEditor)}>
            Team Editor
          </button>
        </li>
        <li>
          <button onClick={() => setCurrentMenu(GameMenu.OnlinePlay)}>
            Online Play
          </button>
        </li>
        <li>
          <button onClick={() => setCurrentMenu(GameMenu.Settings)}>
            Settings
          </button>
        </li>
        <li>
          <button disabled>Developer Tools</button>
        </li>
      </ul>
      <p>
        You can check out the source code over on{" "}
        <a href="https://github.com/Half-Shot/wormgine" target="_blank">
          GitHub
        </a>
        .
      </p>
      <p>
        <a href="https://github.com/Half-Shot/wormgine/blob/main/src/assets/ASSETS.md">
          Assets are used under various licences
        </a>
      </p>
    </SubMenu>
  );
}

const variants = {
  enter: (direction: number) => {
    return {
      x: direction > 0 ? "50vw" : "-50vw",
      opacity: 0,
      transition: { duration: 0.75 },
    };
  },
  center: {
    zIndex: 1,
    scape: 1,
    x: 0,
    opacity: 1,
    transition: { duration: 0.75 },
  },
  exit: (direction: number) => {
    return {
      zIndex: 0,
      x: direction < 0 ? "50vw" : "-50vw",
      opacity: 0,
      transition: { duration: 0.75 },
    };
  },
};

export default function Menu({
  onNewGame,
  client,
  setClientConfig,
  lobbyGameRoomId,
}: Props) {
  const [currentMenu, setCurrentMenu] = useState(GameMenu.MainMenu);
  const [currentLobbyId, setLobbyId] = useState(lobbyGameRoomId);

  useEffect(() => {
    if (currentLobbyId) {
      setCurrentMenu(GameMenu.Lobby);
    } else {
      setCurrentMenu((m) => (m === GameMenu.Lobby ? GameMenu.MainMenu : m));
    }
  }, [currentLobbyId]);

  const onStartNewGame = useCallback(() => {
    localStorage.setItem("wormgine_last_commit", buildCommit);
    setLobbyId("LOCAL_GAME");
  }, [onNewGame]);

  const goBack = () => {
    setCurrentMenu(GameMenu.MainMenu);
    setLobbyId("");
  };
  let menu;

  if (currentMenu === GameMenu.MainMenu) {
    menu = mainMenu(onStartNewGame, setCurrentMenu);
  } else if (currentMenu === GameMenu.OnlinePlay) {
    menu = (
      <SubMenu key={GameMenu.OnlinePlay}>
        <MenuHeader onGoBack={goBack}>Online Play</MenuHeader>
        <OnlinePlayMenu
          onCreateLobby={(roomId) => setLobbyId(roomId)}
          client={client}
          setClientConfig={setClientConfig}
        />
      </SubMenu>
    );
  } else if (currentMenu === GameMenu.TeamEditor) {
    menu = (
      <SubMenu key={GameMenu.TeamEditor}>
        <MenuHeader onGoBack={goBack}>Team Editor</MenuHeader>
        <TeamEditorMenu />
      </SubMenu>
    );
  } else if (currentMenu === GameMenu.Settings) {
    menu = (
      <SubMenu key={GameMenu.Settings}>
        <MenuHeader onGoBack={goBack}>Settings</MenuHeader>
        <SettingsMenu />
      </SubMenu>
    );
  } else if (currentMenu === GameMenu.OverlayTest) {
    menu = (
      <SubMenu key={GameMenu.OverlayTest}>
        <MenuHeader onGoBack={goBack}>Overlay Test</MenuHeader>
        <OverlayTest />
      </SubMenu>
    );
  } else if (currentMenu === GameMenu.Lobby) {
    const onOpenIngame = (gameInstance: IRunningGameInstance) => {
      // TODO: Hardcoded level.
      onNewGame("netGame", gameInstance, "levels_testing");
    };
    if (!currentLobbyId) {
      throw Error("Current Lobby ID must be set!");
    }

    // TODO: Go back needs to exit game?
    menu = (
      <SubMenu key={GameMenu.Lobby}>
        <MenuHeader onGoBack={goBack}>Lobby</MenuHeader>
        <Lobby
          client={client}
          onOpenIngame={onOpenIngame}
          exitToMenu={() => setLobbyId(undefined)}
          gameRoomId={currentLobbyId}
        />
      </SubMenu>
    );
  } else {
    throw Error(`Unknown menu! ${GameMenu[currentMenu]}`);
  }
  return (
    <AnimatePresence
      custom={currentMenu === GameMenu.MainMenu ? 1 : -1}
      initial={true}
    >
      {menu}
    </AnimatePresence>
  );
}
