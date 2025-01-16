import { useState, useCallback, useEffect } from "preact/hooks";
import {
  ClientState,
  NetClientConfig,
  NetGameClient,
} from "../../../net/client";
import config from "../config";
import styles from "./online-play.module.css";
import { useObservableEagerState } from "observable-hooks";
import Logger from "../../../log";
import { DefaultWeaponSchema } from "../../../weapons/schema";

interface Props {
  client: NetGameClient | undefined;
  setClientConfig: (config: NetClientConfig | null) => void;
  onCreateLobby: (roomId: string) => void;
}

const logger = new Logger("menu/online-play");

const AVATAR_PX = 64;

function LoggedInView({
  client,
  onCreateLobby,
}: {
  client: NetGameClient;
  onCreateLobby: (roomId: string) => void;
}) {
  const [displayname, setDisplayName] = useState<string>();
  const [authenticatedAvatarBlob, setAvatarBlobUrl] = useState<string>();

  const createGameCallback = useCallback(() => {
    client
      .createGameRoom({
        rules: {
          winWhenOneGroupRemains: true,
          wormHealth: 100,
          ammoSchema: DefaultWeaponSchema,
        },
      })
      .then((roomId) => onCreateLobby(roomId))
      .catch((ex) => {
        // TODO: Bubble up error.
        logger.info("Failed to create game", ex);
      });
  }, [client]);

  useEffect(() => {
    client.client.getProfileInfo(client.client.getUserId()!).then((data) => {
      setDisplayName(data.displayname ?? client.client.getUserIdLocalpart()!);
      const avatarUrl =
        data.avatar_url &&
        client.client.mxcUrlToHttp(
          data.avatar_url,
          AVATAR_PX,
          AVATAR_PX,
          "scale",
          false,
          true,
          true,
        );
      if (avatarUrl) {
        fetch(avatarUrl, {
          headers: {
            Authorization: `Bearer ${client.client.getAccessToken()}`,
          },
        })
          .then((req) => {
            if (!req.ok) {
              throw Error("Request not OK");
            }
            return req.blob();
          })
          .then((blob) => {
            setAvatarBlobUrl(URL.createObjectURL(blob));
          });
      }
    });
  }, [client]);

  if (!displayname) {
    return null;
  }

  return (
    <>
      <section>
        <p>
          You are logged in as <strong>{displayname}</strong>
        </p>
        {authenticatedAvatarBlob && (
          <img className={styles.avatar} src={authenticatedAvatarBlob}></img>
        )}
      </section>
      <section>
        <p>
          You may press the button below to create a lobby. To join a lobby, use
          a URL provided by the host.
        </p>
        <button onClick={createGameCallback}>Create Lobby</button>
      </section>
    </>
  );
}

function LoginForm({
  setClientConfig,
}: {
  setClientConfig: Props["setClientConfig"];
}) {
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [error, setError] = useState<string>();
  const onSubmit = useCallback(
    async (e: SubmitEvent) => {
      e.preventDefault();
      if (!config.defaultHomeserver) {
        return;
      }
      try {
        setLoginInProgress(true);
        const target = e.target as HTMLFormElement;
        const username = (
          target.elements.namedItem("username") as HTMLInputElement
        ).value;
        const password = (
          target.elements.namedItem("password") as HTMLInputElement
        ).value;
        const { accessToken } = await NetGameClient.login(
          config.defaultHomeserver,
          username,
          password,
        );
        setClientConfig({
          accessToken,
          baseUrl: config.defaultHomeserver,
        });
      } catch (ex) {
        setError((ex as Error).toString());
      } finally {
        setLoginInProgress(false);
      }
    },
    [setClientConfig],
  );

  return (
    <section>
      <p>
        You may log into an existing account below by specifying a username and
        password. Future versions will allow you to create an account / login to
        other servers.
      </p>
      {error && (
        <p>
          Error: <span>{error}</span>
        </p>
      )}
      <form disabled={loginInProgress} onSubmit={onSubmit}>
        <input type="text" placeholder="username" id="username"></input>
        <input type="password" placeholder="password" id="password"></input>
        <button type="submit">Login</button>
      </form>
    </section>
  );
}

export function OnlinePlayWithClient({
  client,
  setClientConfig,
  onCreateLobby,
}: {
  client: NetGameClient;
  setClientConfig: (v: null) => void;
  onCreateLobby: (roomId: string) => void;
}) {
  const clientState = useObservableEagerState(client.state);
  switch (clientState) {
    case ClientState.Connected:
      return <LoggedInView onCreateLobby={onCreateLobby} client={client} />;
    case ClientState.Connecting:
      return (
        <p>Account information is stored and in the progress of connecting.</p>
      );
    case ClientState.AuthenticationError:
      // Client was logged out.
      NetGameClient.clearConfig();
      setClientConfig(null);
      return null;
      break;
    default:
      return (
        <div>
          An error has occured while trying to connect. Error code:
          <code>{ClientState[clientState]}</code>
        </div>
      );
  }
}

export default function OnlinePlayMenu({
  client,
  setClientConfig,
  onCreateLobby,
}: Props) {
  if (!client && !config.defaultHomeserver) {
    return <p>This instance is not configured for network play.</p>;
  } else if (!client) {
    return <LoginForm setClientConfig={setClientConfig} />;
  }

  return (
    <OnlinePlayWithClient
      onCreateLobby={onCreateLobby}
      setClientConfig={setClientConfig}
      client={client}
    />
  );
}
