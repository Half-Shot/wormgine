import { useEffect, useState } from "preact/hooks";
import { Loading } from "./atoms/loading";
import styles from "./loading-page.module.css";
import { useAnimate } from "framer-motion";
import Logger from "../../log";

const log = new Logger("LoadingPage");

export function LoadingPage({
  progress,
  visible,
  force,
}: {
  visible: boolean;
  progress?: number;
  /**
   * Force hiding the loading bar when visible is false */
  force?: boolean;
}) {
  const [scope, animate] = useAnimate();
  const [hasLoadingVideoPlayed, setLoadingVideoPlayed] = useState(false);
  const [shouldOverlay, setShouldOverlay] = useState(true);

  useEffect(() => {
    if (!scope.current) {
      return;
    }
    async function runAnim() {
      if (visible) {
        await animate(
          "video",
          { opacity: 1 },
          { delay: 0, duration: 0.25, ease: "easeIn" },
        );
      } else if (hasLoadingVideoPlayed || force) {
        await animate(
          scope.current,
          { opacity: 0 },
          { delay: 0.5, duration: 0.5, ease: "easeIn" },
        );
        log.info("setShouldOverlay(false)");
        setShouldOverlay(false);
      }
    }
    void runAnim();
  }, [visible, force, hasLoadingVideoPlayed, scope.current]);

  if (!shouldOverlay) {
    return null;
  }

  return (
    <>
      <main className={styles.main} ref={scope}>
        <Loading
          className={styles.loading}
          progress={progress}
          loadingDone={() => setLoadingVideoPlayed(true)}
        />
      </main>
    </>
  );
}
