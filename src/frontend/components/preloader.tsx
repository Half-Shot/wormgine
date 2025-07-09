import { assetLoadPercentage, assetsAreReady } from "../../assets";
import { useObservableEagerState } from "observable-hooks";
import { useGameSettingsHook } from "../../settings";
import { MotionConfig } from "framer-motion";
import { LoadingPage } from "./loading-page";
import Logger from "../../log";

const log = new Logger("Preloader");

export function Preloader() {
  const assetProgress = useObservableEagerState(assetLoadPercentage);
  const assetsLoaded = useObservableEagerState(assetsAreReady);
  const [settings] = useGameSettingsHook();

  log.debug("Loading state", assetProgress, assetsLoaded);

  return (
    <MotionConfig reducedMotion={settings.reduceMotion ? "always" : "user"}>
      <LoadingPage visible={!assetsLoaded} progress={assetProgress} force />
    </MotionConfig>
  );
}
