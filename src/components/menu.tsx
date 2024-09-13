import "./menu.css";

interface Props {
    onNewGame: (level: string) => void
}

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
        </ul>
    </main>;
}