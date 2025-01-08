import useLocalStorageState from "use-local-storage-state";
import menuStyles from "../menu.module.css";
import { useCallback } from "preact/hooks";
import { JSX } from "preact/jsx-runtime";
import {
  GameSettings,
  getGameSettings,
  WORMGINE_STORAGE_KEY_SETTINGS,
} from "../../../settings";

interface Props {
  onGoBack: () => void;
}

export default function SettingsMenu({ onGoBack }: Props) {
  const [settings, setSettings] = useLocalStorageState<GameSettings>(
    WORMGINE_STORAGE_KEY_SETTINGS,
    {
      defaultValue: getGameSettings(),
    },
  );

  const onVolumeSet: JSX.GenericEventHandler<HTMLInputElement> = useCallback(
    (evt) => {
      const element = evt.target as HTMLInputElement;
      setSettings((s: GameSettings) => ({
        ...s,
        soundEffectVolume: element.valueAsNumber / 100,
      }));
    },
    [],
  );

  return (
    <main className={menuStyles.menu}>
      <h1>Settings</h1>
      <section>
        <h2>General</h2>
        <label for="sound-effect-meter">Sound Effect Volume:</label>
        <input
          id="sound-effect-meter"
          type="range"
          style={{ width: "200px" }}
          onChange={onVolumeSet}
          value={settings.soundEffectVolume * 100}
          step={5}
          min={0}
          max={100}
        />
      </section>
      <button onClick={onGoBack}>Back</button>
    </main>
  );
}
