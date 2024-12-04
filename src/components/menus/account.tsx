import { useState, useCallback, useEffect } from "preact/hooks";
import { NetClientConfig, NetGameClient } from "../../net/client";
import { GameMenu } from "./types";
import config from "../config";
import styles from "./account.module.css";

interface Props {
    client: NetGameClient|undefined,
    setCurrentMenu: (menu: GameMenu) => void,
    reloadClient: () => void,
}

const AVATAR_PX = 64;

function LoggedInView({client}: {client: NetGameClient}) {
    const [displayname, setDisplayName] = useState<string>();
    const [authenticatedAvatarBlob, setAvatarBlobUrl] = useState<string>();

    useEffect(() => {
        client.client.getProfileInfo(client.client.getUserId()!).then((data) => {
            setDisplayName(data.displayname ?? client.client.getUserIdLocalpart()!);
            const avatarUrl = data.avatar_url && client.client.mxcUrlToHttp(data.avatar_url, AVATAR_PX, AVATAR_PX, "scale", false, true, true);
            if (avatarUrl) {
                fetch(avatarUrl, { headers: {
                    Authorization: `Bearer ${client.client.getAccessToken()}`
                }}).then((req) => {
                    if (!req.ok) {
                        throw Error('Request not OK');
                    }
                    return req.blob();
                }).then((blob) => {
                    setAvatarBlobUrl(URL.createObjectURL(blob));
                });
            }
        });
    }, [client]);

    if (!displayname) {
        return null;
    }

    return <section>
        <p>You are logged in as <strong>{displayname}</strong></p>
        <img className={styles.avatar} src={authenticatedAvatarBlob}></img>
    </section>
}

export default function AccountMenu({client, setCurrentMenu, reloadClient}: Props) {
    const [loginInProgress, setLoginInProgress] = useState(false);
    const [error, setError] = useState<string>();
    const onSubmit = useCallback(async (e: SubmitEvent) => {
        e.preventDefault();
        if (!config.defaultHomeserver) {
            return;
        }
        try {
            setLoginInProgress(true);
            const target = e.target as HTMLFormElement;
            const username = (target.elements.namedItem('username') as HTMLInputElement).value;
            const password = (target.elements.namedItem('password') as HTMLInputElement).value;
            const { accessToken } = await NetGameClient.login(config.defaultHomeserver, username, password);
            localStorage.setItem('wormgine_client_config', JSON.stringify({
                accessToken,
                baseUrl: config.defaultHomeserver,
            } as NetClientConfig));
            reloadClient();
        } catch (ex) {
            setError((ex as Error).toString());
        } finally {
            setLoginInProgress(false);
        }
    }, [reloadClient]);

    let content;
    if (client?.ready) {
        content = <LoggedInView client={client} />;
    } else if (client?.ready === false) {
        content = <p>Account information is stored and in the progress of connecting.</p>;
    } else if (!client && !config.defaultHomeserver) {
        content = <p>This instance is not configured for network play.</p>
    } else {
        content = <section>
        <p>
            You may log into an existing account below by specifying a username and password. Future versions will allow you to 
            create an account / login to other servers.
        </p>
        {error && <p>Error: <span>{error}</span></p>}
        <form disabled={loginInProgress} onSubmit={onSubmit}>
            <input type="text" placeholder="username" id="username"></input>
            <input type="password" placeholder="password" id="password"></input>
            <button type="submit">Login</button>
        </form>
    </section>;
    }

    return <main className="menu">
        <h1>Wormgine Account</h1>
        <button onClick={() => setCurrentMenu(GameMenu.MainMenu)}>Go Back</button>
        {content}
    </main>;
}