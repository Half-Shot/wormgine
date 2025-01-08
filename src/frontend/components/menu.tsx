import { useCallback, useState } from "preact/hooks";
import { ChangelogModal } from "./changelog";
import styles from "./menu.module.css";
import { NetGameClient } from "../../net/client";
import { GameMenu } from "./menus/types";
import OnlinePlayMenu from "./menus/online-play";
import { OverlayTest } from "./menus/overlaytest";
import type { AssetData } from "../../assets/manifest";
import TeamEditorMenu from "./menus/team-editor";
import SettingsMenu from "./menus/settings";
import MenuHeader from "./atoms/menu-header";

interface Props {
  onNewGame: (scenario: string, level?: keyof AssetData) => void;
  reloadClient: () => void;
  client?: NetGameClient;
}

const buildNumber = import.meta.env.VITE_BUILD_NUMBER;
const buildCommit = import.meta.env.VITE_BUILD_COMMIT;
const lastCommit = localStorage.getItem("wormgine_last_commit");

function mainMenu(
  onStartNewGame: (scenario: string, level?: keyof AssetData) => void,
  setCurrentMenu: (menu: GameMenu) => void,
) {
  return (
    <main className={styles.menu}>
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
          <button onClick={() => onStartNewGame("tiledMap", "levels_testing")}>
            Skirmish
          </button>
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
          <button onClick={() => setCurrentMenu(GameMenu.Settings)}>
            Settings
          </button>
        </li>
        <li>
          <button onClick={() => setCurrentMenu(GameMenu.OnlinePlay)}>
            Online Play
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
    </main>
  );
}

export function Menu({ onNewGame, client, reloadClient }: Props) {
  const [currentMenu, setCurrentMenu] = useState(GameMenu.MainMenu);

  const onStartNewGame = useCallback(
    (scenario: string, level?: keyof AssetData) => {
      localStorage.setItem("wormgine_last_commit", buildCommit);
      onNewGame(scenario, level);
    },
    [onNewGame],
  );

  const goBack = () => setCurrentMenu(GameMenu.MainMenu);

  if (currentMenu === GameMenu.MainMenu) {
    return mainMenu(onStartNewGame, setCurrentMenu);
  } else if (currentMenu === GameMenu.OnlinePlay) {
    return (
      <menu className={styles.menu}>
        <MenuHeader onGoBack={goBack}>Online Play</MenuHeader>
        <OnlinePlayMenu client={client} reloadClient={reloadClient} />
      </menu>
    );
  } else if (currentMenu === GameMenu.TeamEditor) {
    return (
      <menu className={styles.menu}>
        <MenuHeader onGoBack={goBack}>Team Editor</MenuHeader>
        <TeamEditorMenu client={client} />
      </menu>
    );
  } else if (currentMenu === GameMenu.Settings) {
    return (
      <menu className={styles.menu}>
        <MenuHeader onGoBack={goBack}>Settings</MenuHeader>
        <SettingsMenu />
      </menu>
    );
    return;
  } else if (currentMenu === GameMenu.OverlayTest) {
    <menu className={styles.menu}>
      <MenuHeader onGoBack={goBack}>Overlay Test</MenuHeader>
      <OverlayTest />
    </menu>;
  }

  return null;
}
