import { useEffect, useRef, useState } from 'preact/hooks'
import './ingame-view.css'
import { Game } from '../game';

// TODO: Feed game parameters into this.

export function IngameView({level}: {level: string}) {
  const [game, setGame] = useState<Game>();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Game.create(window, level).then((game) => {
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

    ref.current.appendChild(game.canvas);
    game.run();
    (window as any).wormgine = game;
  }, [ref, game]);


  return <div ref={ref} />;
}
