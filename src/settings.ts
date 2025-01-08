export const WORMGINE_STORAGE_KEY_TEAMS = "wormgine.teams";
export const WORMGINE_STORAGE_KEY_SETTINGS = "wormgine.settings";

export interface StoredTeam {
  name: string;
  worms: string[];
  flagb64?: string;
  synced: boolean | null;
}

export interface GameSettings {
    soundEffectVolume: number;
}

const DEFAULT_SETTINGS: GameSettings = {
    soundEffectVolume: 0.1,
};

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

export function getLocalTeams(): StoredTeam[] {
  const item = localStorage.getItem(WORMGINE_STORAGE_KEY_TEAMS);
  if (!item) {
    return [];
  }
  // TODO: Sanitize.
  return JSON.parse(item);
}
