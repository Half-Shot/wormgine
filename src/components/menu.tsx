import { useCallback } from "preact/hooks";
import { ChangelogModal } from "./changelog";
import "./menu.css";

interface Props {
    onNewGame: (level: string) => void
}

const buildNumber = import.meta.env.VITE_BUILD_NUMBER;
const buildCommit = import.meta.env.VITE_BUILD_COMMIT;
const lastCommit = localStorage.getItem('wormgine_last_commit');

export function Menu({onNewGame}: Props) {

    const onStartNewGame = useCallback((level: string) => {
        localStorage.setItem("wormgine_last_commit", buildCommit);
        onNewGame(level);
    }, [onNewGame]);

    return <main className="menu">
        <h1>Wormgine Debug Build</h1>
        <p>
            The game is still in heavy development, this site is updated with the latest builds as they
            are built.
        </p>
        <h2>Test Scenarios</h2>
        <p>
            Each of these levels are used to test certain engine features. Gameplay Demo is the most complete,
            as it demonstrates a match between two human players.
        </p>
        <ul className="levelPicker">
            <li>
                <button onClick={() => onStartNewGame("testingGround")}>Gameplay Demo</button>
            </li>
            <li>
                <button onClick={() => onStartNewGame("grenadeIsland")}>Terrain Demo</button>
            </li>
            <li>
                <button onClick={() => onStartNewGame("uiTest")}>UI Test</button>
            </li>
            <li>
                <button onClick={() => onStartNewGame("replayTesting")}>Test gameplay replay</button>
            </li>
            <li>
                <button onClick={() => onStartNewGame("boneIsles")}>Bone Isles</button>
            </li>
            <li>
                <button onClick={() => onStartNewGame("borealisTribute")}>Borealis Tribute Rock</button>
            </li>
        </ul>
        <ChangelogModal buildNumber={buildNumber} buildCommit={buildCommit} lastCommit={lastCommit}/>
        <p>
            You can check out the source code over on <a href="https://github.com/Half-Shot/wormgine" target="_blank">GitHub</a>.
        </p>
        <p>
            <a href="https://github.com/Half-Shot/wormgine/blob/main/src/assets/ASSETS.md">Assets are used under various licences</a>
        </p>
    </main>;
}