import useLocalStorageState from "use-local-storage-state";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { JSX } from "preact/jsx-runtime";
import styles from "./team-editor.module.css";
import { StoredTeam, WORMGINE_STORAGE_KEY_TEAMS } from "../../../settings";

const MAX_WORM_NAMES = 8;
const MAX_TEAMS = 32;

async function scaleFile(
  file: File,
  { maxWidth, maxHeight }: { maxWidth: number; maxHeight: number },
) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.setAttribute("src", url);
  await img.decode();
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw Error("Failed to get context");
  }
  let newWidth = img.width;
  let newHeight = img.height;
  if (newWidth !== maxWidth) {
    newWidth = maxWidth;
    newHeight = (img.width * maxWidth) / img.width;
  }
  if (newHeight !== maxHeight) {
    newHeight = maxHeight;
    newWidth = (img.height * maxHeight) / img.height;
  }
  canvas.width = newWidth;
  canvas.height = newHeight;
  context.drawImage(img, 0, 0, newWidth, newHeight);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        return resolve(blob);
      } else {
        reject(new Error("Failed to get blob from canvas"));
      }
    });
  });
}

export function TeamEditor({
  team,
  onChange,
  onDeleteTeam,
}: {
  team: StoredTeam;
  onChange: (team: Partial<StoredTeam>) => void;
  onDeleteTeam: () => void;
}) {
  const [tempBlobUrl, setTempBlobUrl] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!tempBlobUrl && team.flagb64) {
      setTempBlobUrl(team.flagb64);
    }
    return () => {
      if (tempBlobUrl) {
        URL.revokeObjectURL(tempBlobUrl);
      }
    };
  }, [team, tempBlobUrl]);

  const onFlagUpload: JSX.GenericEventHandler<HTMLInputElement> = useCallback(
    (evt) => {
      const [imageFile] = (evt.target as HTMLInputElement).files || [];
      if (!imageFile) {
        return;
      }
      scaleFile(imageFile, { maxHeight: 48, maxWidth: 48 })
        .then((blob) => {
          setTempBlobUrl(URL.createObjectURL(blob));
          const f = new FileReader();
          f.addEventListener("load", () => {
            onChange({ flagb64: f.result as string });
          });
          f.readAsDataURL(blob);
        })
        .catch((ex) => {
          console.error("Unable to handle flag file", ex);
        });
    },
    [team],
  );

  return (
    <section className={styles.teamEditor}>
      <input
        className={styles.editable}
        id="team-name"
        type="text"
        value={team.name}
        onChange={(v) => {
          const value = (v.target as HTMLInputElement).value;
          if (value.length < 3 || value.length > 16) {
            return;
          }
          onChange({ name: value });
        }}
      />
      <section>
        <h3> Worms </h3>
        <ol>
          {team.worms.map((wormName, i) => (
            <li key={i}>
              <input
                minLength={3}
                maxLength={16}
                onChange={(v) => {
                  const value = (v.target as HTMLInputElement).value;
                  if (value.length < 3 || value.length > 16) {
                    return;
                  }
                  team.worms[i] = value;
                  onChange({ worms: team.worms });
                }}
                type="text"
                value={wormName}
              ></input>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h3> Flag </h3>

        <button onClick={() => uploadRef.current?.click()}>
          {tempBlobUrl ? (
            <img
              onClick={() => uploadRef.current?.click()}
              src={tempBlobUrl}
            ></img>
          ) : (
            <p>Upload Flag</p>
          )}
        </button>
        <input
          ref={uploadRef}
          hidden
          onChange={onFlagUpload}
          type="file"
          accept="image/jpeg,image/png,image/webp"
        />
      </section>
      <section>
        <button onClick={onDeleteTeam}>Delete Team</button>
      </section>
    </section>
  );
}

export default function TeamEditorMenu() {
  const [localTeams, setLocalTeams] = useLocalStorageState<StoredTeam[]>(
    WORMGINE_STORAGE_KEY_TEAMS,
    {
      defaultValue: [] as StoredTeam[],
    },
  );
  const [selectedTeam, setSelectedTeam] = useState(localTeams[0] ? 0 : -1);

  useEffect(() => {
    let modified = false;
    localTeams.forEach((t) => {
      if (!t.lastModified) {
        t.lastModified = Date.now();
        modified = true;
      }
      if (!t.uuid) {
        t.uuid = crypto.randomUUID();
        modified = true;
      }
    });
    if (modified) {
      setLocalTeams([...localTeams]);
    }
  }, [localTeams]);

  const onCreateTeam = useCallback(() => {
    let newTeamName = "New Team";
    let newTeamNameIdx = 1;
    while (localTeams.some((t) => t.name === newTeamName)) {
      newTeamName = `New Team #${++newTeamNameIdx}`;
    }
    const teamLength = localTeams.length;
    const newTeam = {
      name: newTeamName,
      worms: Array.from({ length: MAX_WORM_NAMES }).map(
        (_, i) => `Worm #${i + 1}`,
      ),
      lastModified: Date.now(),
      uuid: crypto.randomUUID(),
    } satisfies StoredTeam;
    setLocalTeams((t: StoredTeam[]) => [
      ...t,
      newTeam,
    ]);
    console.log(
      {
        name: newTeamName,
        worms: Array.from({ length: MAX_WORM_NAMES }).map(
          (_, i) => `Worm #${i + 1}`,
        ),
        lastModified: Date.now(),
        uuid: crypto.randomUUID(),
      } satisfies StoredTeam);
    setSelectedTeam(teamLength);
  }, [localTeams]);

  const onDeleteTeam = useCallback(() => {
    setLocalTeams((t: StoredTeam[]) => t.filter((_, i) => i !== selectedTeam));
    setSelectedTeam((s) => s - 1);
  }, [selectedTeam, localTeams]);

  const onTeamSelected = useCallback(
    (evt: JSX.TargetedEvent<HTMLSelectElement>) => {
      setSelectedTeam((evt.target as HTMLSelectElement).selectedIndex);
    },
    [],
  );

  const onTeamChanged = useCallback(
    (changes: Partial<StoredTeam>) => {
      setLocalTeams((existing: StoredTeam[]) => {
        existing[selectedTeam] = {
          ...existing[selectedTeam],
          ...changes,
          lastModified: Date.now(),
        };
        return existing;
      });
    },
    [selectedTeam],
  );

  if (!localTeams.length) {
    return (
      <>
        <p>You haven't created any teams yet.</p>
        <button onClick={onCreateTeam}>Create Team</button>
      </>
    );
  }

  return (
    <>
      <select value={selectedTeam} onChange={onTeamSelected}>
        {localTeams.map((t, i) => (
          <option key={t.uuid} value={i}>
            {t.name}
          </option>
        ))}
      </select>
      <button disabled={localTeams.length >= MAX_TEAMS} onClick={onCreateTeam}>
        Add new team
      </button>
      <TeamEditor
        onDeleteTeam={onDeleteTeam}
        team={localTeams[selectedTeam]}
        onChange={onTeamChanged}
      />
    </>
  );
}
