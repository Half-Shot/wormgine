import useLocalStorageState from "use-local-storage-state";
import menuStyles from "../menu.module.css";
import { useCallback } from "preact/hooks";
import { JSX } from "preact/jsx-runtime";
import { GameSettings, getGameSettings, WORMGINE_STORAGE_KEY_SETTINGS } from "../../../settings";

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

  const onVolumeSet: JSX.MouseEventHandler<HTMLMeterElement> = useCallback((evt) => {
    const element = (evt.target as HTMLMeterElement);
    const rect = element.getClientRects()[0];
    const value = Math.round(((evt.clientX - rect.x) / rect.width) * 10) / 10;
    setSettings((s: GameSettings) => ({...s, soundEffectVolume: value}))
  }, []);

  return (
    <main className={menuStyles.menu}>
      <h1>Settings</h1>
      <section>
        <h2>
            General
        </h2>
        <label for="sound-effect-meter">
            Sound Effect Volume: 
        </label>
        <meter title={`${settings.soundEffectVolume * 100}%`} id="sound-effect-meter" role="slider" onClick={onVolumeSet} style={{width: "200px"}} min="0" max="1" value={settings.soundEffectVolume}>75%</meter>
      </section>
      <button onClick={onGoBack}>Back</button>
    </main>
  );
}
