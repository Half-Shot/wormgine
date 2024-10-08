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
        <ul>
            <li>
                <button onClick={() => onStartNewGame("grenadeIsland")}>Open Debug Island</button>
            </li>
            <li>
                <button onClick={() => onStartNewGame("borealisTribute")}>Open Borealis Tribute Rock</button>
            </li>
            <li>
                <button onClick={() => onStartNewGame("testingGround")}>Open Testing Ground</button>
            </li>
            <li>
                <button onClick={() => onStartNewGame("boneIsles")}>Bone Isles</button>
            </li>
            <li>
                <button onClick={() => onStartNewGame("uiTest")}>UI Test</button>
            </li>
        </ul>
        <ChangelogModal buildNumber={buildNumber} buildCommit={buildCommit} lastCommit={lastCommit}/>
    </main>;
}