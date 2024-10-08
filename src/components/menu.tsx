import { ChangelogModal } from "./changelog";
import "./menu.css";

interface Props {
    onNewGame: (level: string) => void
}

const buildNumber = import.meta.env.VITE_BUILD_NUMBER;
const buildCommit = import.meta.env.VITE_BUILD_COMMIT;
const lastCommit = localStorage.getItem('wormgine_last_commit');

export function Menu(props: Props) {
    return <main className="menu">
        <h1>Wormgine Debug Build</h1>
        <ul>
            <li>
                <button onClick={() => props.onNewGame("grenadeIsland")}>Open Debug Island</button>
            </li>
            <li>
                <button onClick={() => props.onNewGame("borealisTribute")}>Open Borealis Tribute Rock</button>
            </li>
            <li>
                <button onClick={() => props.onNewGame("testingGround")}>Open Testing Ground</button>
            </li>
            <li>
                <button onClick={() => props.onNewGame("boneIsles")}>Bone Isles</button>
            </li>
        </ul>
        <ChangelogModal buildNumber={buildNumber} buildCommit={buildCommit} lastCommit={lastCommit}/>
    </main>;
}