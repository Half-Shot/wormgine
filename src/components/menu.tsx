import { useCallback, useState } from "preact/hooks";
import { ChangelogModal } from "./changelog";
import styles from "./menu.module.css";
import { NetGameClient } from "../net/client";
import { GameMenu } from "./menus/types";
import AccountMenu from "./menus/account";
import { OverlayTest } from "./menus/overlaytest";
import type { AssetData } from "../assets/manifest";

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
  clientReady?: boolean,
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
            Skrimish
          </button>
        </li>
        <li>
          <button disabled>Missions</button>
        </li>
        <li>
          <button>Team Editor</button>
        </li>
        <li>
          <button disabled>Settings</button>
        </li>
        <li>
          <button disabled>Online Play</button>
        </li>
        <li>
          <button>Developer Tools</button>
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
  const [clientReady, setClientReady] = useState(client?.ready);

  client?.once("sync", () => {
    setClientReady(true);
  });

  const onStartNewGame = useCallback(
    (scenario: string, level?: keyof AssetData) => {
      localStorage.setItem("wormgine_last_commit", buildCommit);
      onNewGame(scenario, level);
    },
    [onNewGame],
  );

  if (currentMenu === GameMenu.MainMenu) {
    return mainMenu(onStartNewGame, setCurrentMenu, clientReady);
  } else if (currentMenu === GameMenu.AccountMenu) {
    return (
      <AccountMenu
        client={client}
        reloadClient={reloadClient}
        setCurrentMenu={setCurrentMenu}
      />
    );
  } else if (currentMenu === GameMenu.TeamEditor) {
    return (
      <AccountMenu
        client={client}
        reloadClient={reloadClient}
        setCurrentMenu={setCurrentMenu}
      />
    );
  } else if (currentMenu === GameMenu.OverlayTest) {
    return <OverlayTest />;
  }

  return null;
}
