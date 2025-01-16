import useLocalStorageState from "use-local-storage-state";
import { NetClientConfig } from "./net/client";

export const WORMGINE_STORAGE_KEY_TEAMS = "wormgine.teams";
export const WORMGINE_STORAGE_KEY_SETTINGS = "wormgine.settings";
export const WORMGINE_STORAGE_KEY_CLIENT_CONFIG = "wormgine.client_config";

export interface StoredTeam {
  name: string;
  worms: string[];
  flagb64?: string;
  lastModified: number;
  uuid: string;
}

export interface GameSettings {
  soundEffectVolume: number;
}

const DEFAULT_SETTINGS: GameSettings = {
  soundEffectVolume: 0.1,
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

export function getLocalTeamsHook() {
  return useLocalStorageState<StoredTeam[]>(WORMGINE_STORAGE_KEY_TEAMS);
}

export function getLocalTeams(): StoredTeam[] {
  const item = localStorage.getItem(WORMGINE_STORAGE_KEY_TEAMS);
  if (!item) {
    return [];
  }
  // TODO: Sanitize.
  return JSON.parse(item);
}
