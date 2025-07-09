import { useEffect, useRef, useState } from "preact/hooks";
import styles from "./ingame-view.module.css";
import { type Game } from "../../game";
import { AmmoCount, GameReactChannel } from "../../interop/gamechannel";
import { WeaponSelector } from "./gameui/weapon-select";
import {
  IRunningGameInstance,
  LocalGameInstance,
} from "../../logic/gameinstance";
import { LoadingPage } from "./loading-page";
import Logger from "../../log";
import { logger } from "matrix-js-sdk/lib/logger";

const log = new Logger("ingame-view");

if (import.meta.hot) {
  import.meta.hot.accept("../../game", (newFoo) => {
    log.info("New foo", newFoo);
  });
}

export function IngameView({
  scenario,
  level,
  gameReactChannel,
  gameInstance,
}: {
  scenario: string;
  level?: string;
  gameReactChannel: GameReactChannel;
  gameInstance: IRunningGameInstance;
}) {
  const [hasLoaded, setLoaded] = useState<boolean>(false);
  const [fatalError, setFatalError] = useState<Error>();
  const [game, setGame] = useState<Game>();
  const ref = useRef<HTMLDivElement>(null);
  const [weaponMenu, setWeaponMenu] = useState<AmmoCount | null>(null);

  const onGameLoaded = (newGame: Game) => {
    if (!newGame) {
      return;
    }

    // Bind the game to the window such that we can debug it.
    (globalThis as unknown as { wormgine: Game }).wormgine = newGame;

    newGame.needsReload$.subscribe((previousState) => {
      setLoaded(false);
      log.info("needs reload");
      // We deliberatly want to load a new version of the game.
      import(/* @vite-ignore */ `../../game?ts=${Date.now()}`)
        .then((imp) =>
          imp.Game.create(
            window,
            scenario,
            gameReactChannel,
            gameInstance,
            level,
            previousState,
          ),
        )
        .then((g) => {
          setGame(g);
          logger.info("onGameLoaded called");
          onGameLoaded(g);
        });
    });

    newGame.ready$.subscribe((r) => {
      if (r) {
        log.info("Game loaded");
        setLoaded(true);
      }
    });

    newGame.run().catch((ex) => {
      setFatalError(ex);
      newGame.destroy();
    });
  };

  useEffect(() => {
    let newGame: Game;
    async function init() {
      if (gameInstance instanceof LocalGameInstance) {
        // XXX: Only so the game feels more responsive by capturing this inside the loading phase.
        await gameInstance.startGame();
        log.info("Game started");
      }
      const { Game } = await import("../../game");
      newGame = await Game.create(
        window,
        scenario,
        gameReactChannel,
        gameInstance,
        level,
      );
      setGame(newGame);
      logger.info("useEffect called");
      onGameLoaded(newGame);
    }

    void init().catch((ex) => {
      setFatalError(ex);
    });

    return () => {
      log.info('Ingame view destroyed');
      newGame?.destroy();
    }
  }, []);

  useEffect(() => {
    if (!ref.current || !game) {
      return;
    }
    ref.current.replaceChildren(game.canvas);
  }, [ref, game]);

  useEffect(() => {
    const fnToggle = (weapons: AmmoCount) => {
      setWeaponMenu((s) => (s ? null : weapons));
    };
    const fnClose = () => {
      setWeaponMenu(null);
    };

    gameReactChannel.on("openWeaponMenu", fnToggle);
    gameReactChannel.on("closeWeaponMenu", fnClose);
    return () => {
      gameReactChannel.off("openWeaponMenu", fnToggle);
      gameReactChannel.off("closeWeaponMenu", fnClose);
    };
  }, [gameReactChannel]);

  if (fatalError) {
    return (
      <div className={styles.fatalScreen}>
        <h1>A fatal error has occured and the game must be stopped</h1>
        <h2>{fatalError.message}</h2>
        {fatalError.cause ? (
          <h3> {(fatalError.cause as Error).message}</h3>
        ) : null}
        <pre>
          {fatalError.cause
            ? (fatalError.cause as Error).stack
            : fatalError.stack}
        </pre>
      </div>
    );
  }

  return (
    <>
      <LoadingPage visible={!hasLoaded} force />
      <div id="overlay" className={styles.overlay}>
        <WeaponSelector
          weapons={weaponMenu}
          onWeaponPicked={(code) => {
            gameReactChannel.weaponMenuSelect(code);
            setWeaponMenu(null);
          }}
        />
      </div>
      <div ref={ref} />
    </>
  );
}
