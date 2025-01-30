import useLocalStorageState from "use-local-storage-state";
import { NetClientConfig } from "../net/client";

export * from "./teams";

export const WORMGINE_STORAGE_KEY_SETTINGS = "wormgine.settings";
export const WORMGINE_STORAGE_KEY_CLIENT_CONFIG = "wormgine.client_config";

export interface GameSettings {
  soundEffectVolume: number;
  reduceMotion: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  soundEffectVolume: 0.1,
  reduceMotion: false,
};

export function getClientConfigHook() {
  return useLocalStorageState<NetClientConfig>(
    WORMGINE_STORAGE_KEY_CLIENT_CONFIG,
  );
}

export function getGameSettings(): GameSettings {
  const item = localStorage.getItem(WORMGINE_STORAGE_KEY_SETTINGS);
  if (!item) {
    return DEFAULT_SETTINGS;
  }
  // TODO: Sanitize.
  return {
    ...DEFAULT_SETTINGS,
    ...JSON.parse(item),
  };
}

export function useGameSettingsHook() {
  return useLocalStorageState<GameSettings>(WORMGINE_STORAGE_KEY_SETTINGS, {
    defaultValue: getGameSettings(),
  });
}
