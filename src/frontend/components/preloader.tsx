import { assetLoadPercentage, assetsAreReady } from "../../assets";
import { useObservableEagerState } from "observable-hooks";
import { useGameSettingsHook } from "../../settings";
import { MotionConfig } from "framer-motion";
import { LoadingPage } from "./loading-page";

export function Preloader() {
    const assetProgress = useObservableEagerState(assetLoadPercentage);
    const assetsLoaded = useObservableEagerState(assetsAreReady);
    const [settings] = useGameSettingsHook();

    return (
        <MotionConfig reducedMotion={settings.reduceMotion ? "always" : "user"}>
            <LoadingPage visible={!assetsLoaded} progress={assetProgress} />
        </MotionConfig>
    );
}
