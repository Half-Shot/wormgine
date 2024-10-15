import { useCallback, useState } from "preact/hooks";
import { ChangelogModal } from "./changelog";
import "./menu.css";
import { NetClientConfig, NetGameClient } from "../net/client";

interface Props {
    onNewGame: (level: string) => void,
    reloadClient: () => void,
    client?: NetGameClient,
}

const buildNumber = import.meta.env.VITE_BUILD_NUMBER;
const buildCommit = import.meta.env.VITE_BUILD_COMMIT;
const DEFAULT_HOMESERVER = import.meta.env.VITE_DEFAULT_HOMESERVER;
const lastCommit = localStorage.getItem('wormgine_last_commit');

enum CurrentMenu {
    MainMenu,
    AccountMenu,
}

function mainMenu(onStartNewGame: (level: string) => void, setCurrentMenu: (menu: CurrentMenu) => void, clientReady?: boolean) {
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
                <button onClick={() => setCurrentMenu(CurrentMenu.AccountMenu)}>Manage Account</button>
            </li>
            <li>
                <button disabled={!clientReady} onClick={() => onStartNewGame("lobbyGame")}>Start new network game</button> (Requires configured client)
            </li>
            <li>
                <button onClick={() => onStartNewGame("boneIsles")}>Bone Isles</button>
            </li>
            <li>
                <button className="borealis" onClick={() => onStartNewGame("borealisTribute")}>Borealis Tribute Rock</button>
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

function accountMenu(client: NetGameClient|undefined, setCurrentMenu: (menu: CurrentMenu) => void, reloadClient: () => void) {
    const [loginInProgress, setLoginInProgress] = useState(false);
    const [error, setError] = useState<string>();
    const onSubmit = useCallback(async (e: SubmitEvent) => {
        e.preventDefault();
        try {
            setLoginInProgress(true);
            const target = e.target as HTMLFormElement;
            const username = (target.elements.namedItem('username') as HTMLInputElement).value;
            const password = (target.elements.namedItem('password') as HTMLInputElement).value;
            const { accessToken } = await NetGameClient.login(DEFAULT_HOMESERVER as string, username, password);
            localStorage.setItem('wormgine_client_config', JSON.stringify({
                accessToken,
                baseUrl: DEFAULT_HOMESERVER,
            } as NetClientConfig));
            reloadClient();
        } catch (ex) {
            setError(ex.toString());
        } finally {
            setLoginInProgress(false);
        }
    }, [reloadClient]);

    return <main className="menu">
        <h1>Wormgine Account</h1>
        <button onClick={() => setCurrentMenu(CurrentMenu.MainMenu)}>Go Back</button>
        <p>
            You may log into an existing account below by specifying a username and password. Future versions will allow you to 
            create an account / login to other servers.
        </p>
        {client?.ready === false && <p>Account information is stored and in the progress of connecting.</p>}
        {client?.ready === true && <p>You are logged in as {client.client.getUserId()}.</p>}
        {!client && !DEFAULT_HOMESERVER  && <p>No homeserver defined in config.</p>}
        {!client && DEFAULT_HOMESERVER && <section>
            {error && <p>Error: <span>{error}</span></p>}
            <form disabled={loginInProgress} onSubmit={onSubmit}>
                <input type="text" placeholder="username" id="username"></input>
                <input type="password" placeholder="password" id="password"></input>
                <button type="submit">Login</button>
            </form>
        </section>
        }
    </main>;
}


export function Menu({onNewGame, client, reloadClient}: Props) {
    const [currentMenu, setCurrentMenu] = useState(CurrentMenu.MainMenu);
    const [clientReady, setClientReady] = useState(client?.ready);

    client?.once('sync', () => {
        setClientReady(true);
    })

    const onStartNewGame = useCallback((level: string) => {
        localStorage.setItem("wormgine_last_commit", buildCommit);
        onNewGame(level);
    }, [onNewGame]);

    if (currentMenu === CurrentMenu.MainMenu) {
        return mainMenu(onStartNewGame, setCurrentMenu, clientReady);
    } else if (currentMenu === CurrentMenu.AccountMenu) {
        return accountMenu(client, setCurrentMenu, reloadClient);
    }

    return null;
}