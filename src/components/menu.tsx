import "./menu.css";

interface Props {
    onNewGame: (level: string) => void
}

const buildNumber = import.meta.env.VITE_BUILD_NUMBER ?? 'unknown';

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
        <small>Build number {buildNumber}</small>
    </main>;
}