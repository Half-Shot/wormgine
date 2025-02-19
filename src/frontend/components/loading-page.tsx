import { useEffect, useState } from "preact/hooks";
import { Loading } from "./atoms/loading";
import styles from "./loading-page.module.css";
import { useAnimate } from "framer-motion";

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
  const [isLoadingDone, setLoadingDone] = useState(false);
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
      } else if (isLoadingDone || force) {
        await animate(
          scope.current,
          { opacity: 0 },
          { delay: 0.5, duration: 0.5, ease: "easeIn" },
        );
        setShouldOverlay(false);
      }
    }
    void runAnim();
  }, [visible, force, isLoadingDone, scope.current]);

  if (!shouldOverlay) {
    return null;
  }

  return (
    <>
      <main className={styles.main} ref={scope}>
        <Loading
          className={styles.loading}
          progress={progress}
          loadingDone={() => setLoadingDone(true)}
        />
      </main>
    </>
  );
}
