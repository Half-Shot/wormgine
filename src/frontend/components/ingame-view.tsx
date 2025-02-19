import { useEffect, useRef, useState } from "preact/hooks";
import styles from "./ingame-view.module.css";
import { Game } from "../../game";
import { AmmoCount, GameReactChannel } from "../../interop/gamechannel";
import { WeaponSelector } from "./gameui/weapon-select";
import { IRunningGameInstance, LocalGameInstance } from "../../logic/gameinstance";
import { LoadingPage } from "./loading-page";

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
  useEffect(() => {
  
    async function init() {
      if (gameInstance instanceof LocalGameInstance) {
        // XXX: Only so the game feels more responsive by capturing this inside the loading phase.
        await gameInstance.startGame();
        console.log("Game started");
      }
      const game = await Game.create(window, scenario, gameReactChannel, gameInstance, level);
      setGame(game);
      game.ready$.subscribe(r => {
        if (r) {
          console.log("Game loaded");
          setLoaded(true);
        }
      });
      // Bind the game to the window such that we can debug it.
      (globalThis as unknown as { wormgine: Game }).wormgine = game;
      await game.loadResources();
    }
  
    void init().catch((ex) => {
      setFatalError(ex);
    });
  }, []);

  useEffect(() => {
    if (!ref.current || !game) {
      return;
    }
    if (ref.current.children.length > 0) {
      // Already bound
      return;
    }

    ref.current.appendChild(game.canvas);
    game.run().catch((ex) => {
      setFatalError(ex);
      game.destroy();
    });
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
