import { useEffect, useRef, useState } from 'preact/hooks'
import './ingame-view.css'
import { Game, GoToMenuContext } from '../game';


export function IngameView({level, onGoToMenu}: {level: string, onGoToMenu: (context: GoToMenuContext) => void}) {
  const [game, setGame] = useState<Game>();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Game.create(window, level, onGoToMenu).then((game) => {
      game.loadResources().then(() => {
        setGame(game)
      });
    })
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
    (window as unknown as {wormgine: Game}).wormgine = game;
    ref.current.appendChild(game.canvas);
    game.run();
  }, [ref, game]);


  return <div ref={ref} />;
}
