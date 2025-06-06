import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import styles from "./changelog.module.css";

export function ChangelogModal({
  buildNumber,
  buildCommit,
  lastCommit,
}: {
  buildNumber?: number;
  buildCommit?: string;
  lastCommit?: string | null;
}) {
  const modalRef = useRef<HTMLDialogElement>(null);
  const [latestChanges, setLatestChanges] = useState<string[]>();
  const hasNewBuild = true; /*useMemo(
    () =>
      buildCommit &&
      lastCommit &&
      buildCommit !== lastCommit &&
      latestChanges?.length,
    [buildCommit, lastCommit, latestChanges],
  );*/

  useEffect(() => {
    if (!buildCommit || !lastCommit) {
      return;
    }

    (async () => {
      const req = await fetch(
        `https://api.github.com/repos/Half-Shot/wormgine/compare/${lastCommit}...${buildCommit}`,
      );
      if (!req.ok) {
        // No good.
        setLatestChanges(["Could not load changes"]);
        return;
      }
      const result = (await req.json()) as {
        commits: { commit: { message: string } }[];
      };

      setLatestChanges(
        result.commits
          .map((c) => c.commit.message)
          .filter((m) => m.trim().match(/^\[(feat|bugfix|note)\]/i))
          .reverse(),
      );
    })();
  }, [buildCommit, lastCommit, setLatestChanges]);

  const onClick = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      modalRef.current?.showModal();
    },
    [modalRef],
  );

  const newChangesModal = useMemo(() => {
    const title = buildNumber
      ? `Build #${buildNumber}`
      : `Developer Build ${buildCommit}`;
    return (
      <dialog ref={modalRef}>
        <h2>{title}</h2>
        <p>Changes since {lastCommit?.slice(0, 8)}</p>
        <ol>{latestChanges?.map((v, i) => <li key={i}>{v}</li>)}</ol>
        <button onClick={() => modalRef.current?.close()}>Close</button>
      </dialog>
    );
  }, [buildNumber, buildCommit, lastCommit, latestChanges, modalRef]);

  if (!buildNumber && !buildCommit) {
    return <p>Unknown build</p>;
  }

  const newChangesButton = (
    <a
      className={styles.buildNumber}
      href={hasNewBuild ? "#" : undefined}
      onClick={hasNewBuild ? onClick : undefined}
    >
      {buildNumber ?? <code>{buildCommit}</code>}
    </a>
  );

  return (
    <>
      <span>Build number {newChangesButton}</span>
      {newChangesModal}
    </>
  );
}
