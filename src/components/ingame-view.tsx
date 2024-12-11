import { useEffect, useRef, useState } from "preact/hooks";
import styles from "./ingame-view.module.css";
import { Game } from "../game";
import { NetGameInstance } from "../net/client";
import { GameReactChannel } from "../interop/gamechannel";
import { IWeaponDefiniton } from "../weapons/weapon";
import { WeaponSelector } from "./gameui/weapon-select";

export function IngameView({
  level,
  gameReactChannel,
  gameInstance,
}: {
  level: string;
  gameReactChannel: GameReactChannel;
  gameInstance?: NetGameInstance;
}) {
  const [game, setGame] = useState<Game>();
  const ref = useRef<HTMLDivElement>(null);
  const [weaponMenu, setWeaponMenu] = useState<IWeaponDefiniton[] | null>(null);
  useEffect(() => {
    Game.create(window, level, gameReactChannel, gameInstance).then((game) => {
      (window as unknown as { wormgine: Game }).wormgine = game;
      game.loadResources().then(() => {
        setGame(game);
      });
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

    // Bind the game to the window such that we can debug it.
    ref.current.appendChild(game.canvas);
    game.run();
  }, [ref, game]);

  useEffect(() => {
    const fn = (weapons: IWeaponDefiniton[]) => {
      if (weaponMenu) {
        setWeaponMenu(null);
      } else {
        setWeaponMenu(weapons);
      }
    };
    gameReactChannel.on("openWeaponMenu", fn);
    return () => gameReactChannel.off("openWeaponMenu", fn);
  }, [gameReactChannel, weaponMenu]);

  return (
    <>
      <div id="overlay" className={styles.overlay}>
        {weaponMenu && (
          <WeaponSelector
            weapons={weaponMenu}
            onWeaponPicked={(code) => {
              gameReactChannel.weaponMenuSelect(code);
              setWeaponMenu(null);
            }}
          />
        )}
      </div>
      <div ref={ref} />
    </>
  );
}
