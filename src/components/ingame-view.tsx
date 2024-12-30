import { useEffect, useRef, useState } from "preact/hooks";
import styles from "./ingame-view.module.css";
import { Game } from "../game";
import { NetGameInstance } from "../net/client";
import { GameReactChannel } from "../interop/gamechannel";
import { IWeaponDefiniton } from "../weapons/weapon";
import { WeaponSelector } from "./gameui/weapon-select";

export function IngameView({
  scenario,
  level,
  gameReactChannel,
  gameInstance,
}: {
  scenario: string;
  level?: string;
  gameReactChannel: GameReactChannel;
  gameInstance?: NetGameInstance;
}) {
  const [fatalError, setFatalError] = useState<Error>();
  const [game, setGame] = useState<Game>();
  const ref = useRef<HTMLDivElement>(null);
  const [weaponMenu, setWeaponMenu] = useState<IWeaponDefiniton[] | null>(null);
  useEffect(() => {
    Game.create(window, scenario, gameReactChannel, level, gameInstance).then(
      (game) => {
        (window as unknown as { wormgine: Game }).wormgine = game;
        game.loadResources().then(() => {
          setGame(game);
        });
      },
    ).catch((ex) => {
      setFatalError(ex);
    });
  }, []);

  useEffect(() => {
    if (fatalError) {
      return;
    }
    if (!ref.current || !game) {
      return;
    }
    if (ref.current.children.length > 0) {
      // Already bound
      return;
    }

    // Bind the game to the window such that we can debug it.
    ref.current.appendChild(game.canvas);
    game.run().catch((ex) => {
      setFatalError(ex);
      game.destroy();
    });
  }, [ref, game, fatalError]);

  useEffect(() => {
    if (fatalError) {
      return;
    }
    const fn = (weapons: IWeaponDefiniton[]) => {
      if (weaponMenu) {
        setWeaponMenu(null);
      } else {
        setWeaponMenu(weapons);
      }
    };
    gameReactChannel.on("openWeaponMenu", fn);
    return () => gameReactChannel.off("openWeaponMenu", fn);
  }, [gameReactChannel, weaponMenu, fatalError]);

  if (fatalError) {
    return <div className={styles.fatalScreen}>
      <h1>A fatal error has occured and the game must be stopped</h1>
      <h2>
        {fatalError.message}
      </h2>
      {fatalError.cause ? <h3> {(fatalError.cause as Error).message}</h3> : null}
      <pre>
        {fatalError.cause ? (fatalError.cause as Error).stack : fatalError.stack}
      </pre>
    </div>
  }

  return (
    <>
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
