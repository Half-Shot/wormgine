import { useEffect, useMemo, useState } from "preact/hooks";
import { IngameView } from "./ingame-view";
import { Menu } from "./menu";
import { loadAssets } from "../assets";

export function App() {
    const [gameState, setGameState] = useState<{}>();
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
        return <IngameView />
    };

    return <Menu onNewGame={() => setGameState({})}/>
}