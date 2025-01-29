import { useCallback } from "preact/hooks";
import { JSX } from "preact/jsx-runtime";
import { GameSettings, useGameSettingsHook } from "../../../settings";

export default function SettingsMenu() {
  const [settings, setSettings] = useGameSettingsHook();

  const applySettingChange = useCallback((newConfig: Partial<GameSettings>) => {
    setSettings((oldSettings: GameSettings) => ({
      ...oldSettings,
      ...newConfig,
    }));
  }, []);

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
    <>
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
      <section>
        <h2>Accessibility</h2>
        <label for="sound-effect-meter">
          Reduce motion (menus, game effects)
        </label>
        <input
          type="checkbox"
          onChange={() =>
            applySettingChange({ reduceMotion: !settings.reduceMotion })
          }
          checked={settings.reduceMotion}
        />
      </section>
    </>
  );
}
