import { useCallback, useEffect, useState } from "preact/hooks";
import { IngameView } from "./ingame-view";
import { Menu } from "./menu";
import { loadAssets } from "../assets";

interface LoadGameProps {
    level: string;
}

export function App() {
    const [gameState, setGameState] = useState<LoadGameProps>();
    const [assetProgress, setAssetProgress] = useState(0);
    const [assetsLoaded, setAssetsLoaded] = useState(false);

    const onGoToMenu = useCallback(() => {
        // TODO: Show a win screen!
        setGameState(undefined);
    }, []);

    useEffect(() => {
        void loadAssets((v) => { setAssetProgress(v) }).then(() => setAssetsLoaded(true));
    }, [setAssetProgress]);

    if (!assetsLoaded) {
        return <main>
            Loading <progress value={assetProgress*100} min={0} max={100}></progress> {Math.round(assetProgress*100)}%
        </main>;
    }
    if (gameState) {
        return <IngameView level={gameState.level} onGoToMenu={onGoToMenu} />
    }

    return <Menu onNewGame={(level) => setGameState({level})}/>
}