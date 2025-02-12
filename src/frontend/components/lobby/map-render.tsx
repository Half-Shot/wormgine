import { useObservableState } from "observable-hooks";
import { IGameInstance } from "../../../logic/gameinstance";
import { useCallback, useRef } from "preact/hooks";

export function MapPicker({ gameInstance }: { gameInstance: IGameInstance }) {
  const upload = useRef<HTMLInputElement | null>(null);
  const src = useObservableState(gameInstance.terrainThumbnail);
  const name = useObservableState(gameInstance.mapName);
  const onChange = useCallback(async () => {
    const files = upload.current?.files;
    if (!files) {
      return;
    }
    await gameInstance.uploadNewLevel("levels_testing", files[0]);
  }, [upload, gameInstance]);
  return (
    <div>
      {name && <h3>{name}</h3>}
      {src && <img style={{ width: "384px", background: "black" }} src={src} />}
      <form>
        <input onChange={onChange} ref={upload} hidden type="file" />
        <button
          onClick={(evt) => {
            evt.preventDefault();
            upload.current?.click();
          }}
        >
          Upload map...
        </button>
      </form>
    </div>
  );
}
