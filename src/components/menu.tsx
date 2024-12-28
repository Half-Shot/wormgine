import { useCallback, useState } from "preact/hooks";
import { ChangelogModal } from "./changelog";
import "./menu.css";
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
    <main className="menu">
      <h1>Wormgine Debug Build</h1>
      <p>
        The game is still in heavy development, this site is updated with the
        latest builds as they are built.
      </p>
      <h2>Test Scenarios</h2>
      <p>
        Each of these levels are used to test certain engine features. Gameplay
        Demo is the most complete, as it demonstrates a match between two human
        players.
      </p>
      <ul className="levelPicker">
        <li>
          <button onClick={() => onStartNewGame("testingGround")}>
            Gameplay Demo
          </button>
        </li>
        <li>
          <button onClick={() => onStartNewGame("grenadeIsland")}>
            Terrain Demo
          </button>
        </li>
        <li>
          <button onClick={() => onStartNewGame("uiTest")}>UI Test</button>
        </li>
        <li>
          <button onClick={() => onStartNewGame("replayTesting")}>
            Test gameplay replay
          </button>
        </li>
        <li>
          <button
            onClick={() => onStartNewGame("tiledMap", "levels_targetTraining")}
          >
            Bone Isles
          </button>
        </li>
        <li>
          <button
            onClick={() => onStartNewGame("tiledMap", "levels_targetTraining")}
          >
            Test map loading
          </button>
        </li>
        <li>
          <button
            className="borealis"
            onClick={() => onStartNewGame("tiledMap", "levels_borealis")}
          >
            Borealis Tribute Rock
          </button>
        </li>
        <h2> Network options (requires configured client) </h2>
        <li>
          <button onClick={() => setCurrentMenu(GameMenu.AccountMenu)}>
            Manage Account
          </button>
        </li>
        <li>
          <button
            disabled={!clientReady}
            onClick={() => setCurrentMenu(GameMenu.TeamEditor)}
          >
            Edit Teams
          </button>
        </li>
        <li>
          <button
            disabled={!clientReady}
            onClick={() => onStartNewGame("lobbyGame")}
          >
            Start new network game
          </button>{" "}
          (Requires configured client)
        </li>
        <h2> Developer tools </h2>
        <li>
          <button onClick={() => setCurrentMenu(GameMenu.OverlayTest)}>
            Test Game UI elements
          </button>
        </li>
      </ul>
      <ChangelogModal
        buildNumber={buildNumber}
        buildCommit={buildCommit}
        lastCommit={lastCommit}
      />
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
