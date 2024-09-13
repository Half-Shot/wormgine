import "./menu.css";

interface Props {
    onNewGame: () => void
}

export function Menu(props: Props) {
    return <main className="menu">
        <h1>Wormgine Debug Build</h1>
        <ul>
            <li>
                <button onClick={() => props.onNewGame()}>Open Debug Island</button>
            </li>
        </ul>
    </main>;
}