import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

export function ChangelogModal({buildNumber, buildCommit, lastCommit}: {buildNumber?: number, buildCommit?: string, lastCommit?: string|null}) {
    const modalRef = useRef<HTMLDialogElement>(null);
    const hasNewBuild = useMemo(() => buildCommit && lastCommit && buildCommit !== lastCommit, [buildCommit, lastCommit]);
    const [latestChanges, setLatestChanges] = useState<string[]>();

    useEffect(() => {
        if (!buildCommit || !lastCommit) {
            return;
        }

        (async () => {
            const req = await fetch(`https://api.github.com/repos/Half-Shot/wormgine/compare/${lastCommit}...${buildCommit}`);
            if (!req.ok) {
                // No good.
                setLatestChanges(['Could not load changes']);
            }
            const result = await req.json();
            console.log(result);
            setLatestChanges(result.commits.map((c: any) => `${c.commit.message}`).reverse());
        })();
    }, [buildCommit, lastCommit, setLatestChanges]);

    const onClick = useCallback((e: MouseEvent) => {
        e.preventDefault();
        modalRef.current?.showModal();
    }, [modalRef]);

    const newChangesModal = useMemo(() => {
        console.log(latestChanges);
        const title = buildNumber ? `Build #${buildNumber}` : `Developer Build ${buildCommit}`;
        return <dialog ref={modalRef}>
            <h1>{title}</h1>
            <p>
                Changes since {lastCommit?.slice(0,8)}
            </p>
            <ol>
                {latestChanges?.map((v,i) => 
                    <li key={i}>{v}</li>
                )}
            </ol>
        </dialog>;
    }, [buildNumber, buildCommit, lastCommit, latestChanges, modalRef]);

    if (!buildNumber && !buildCommit) {
        return <p>Unknown build</p>;
    }

    let newChangesButton = null;

    if (hasNewBuild) {
        newChangesButton = <button onClick={onClick}>
            See what's new!
        </button>;
    }

    return <>
        <p>Build number {buildNumber ?? buildCommit} {newChangesButton}</p>
        {newChangesModal}
    </>;
}