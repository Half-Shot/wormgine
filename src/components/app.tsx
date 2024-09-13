import { useEffect, useState } from "preact/hooks";
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

    useEffect(() => {
        // TODO: Progress is broken.
        void loadAssets((v) => { console.log('bork', v); setAssetProgress(assetProgress)}).then(() => setAssetsLoaded(true));
    }, [setAssetProgress]);

    if (!assetsLoaded) {
        return <main>
            Loading <progress value={assetProgress*100} min={0} max={100}></progress> {assetProgress*100}%
        </main>;
    }
    if (gameState) {
        return <IngameView level={gameState.level} />
    }

    return <Menu onNewGame={(level) => setGameState({level})}/>
}