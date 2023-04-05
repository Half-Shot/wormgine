import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import './app.css'
import { Game } from './game';

export function App() {
  const [game, setGame] = useState<Game>();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const game = new Game(window.innerWidth, window.innerHeight);
    game.loadResources().then(() => {
      setGame(game)
    });
  }, [false]);
 
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
  }, [ref, game]);

  return <div ref={ref} />;
}
