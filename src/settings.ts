export const SOUND_EFFECT_VOLUME = 0.5;

export const WORMGINE_STORAGE_KEY_TEAMS = "wormgine.teams";

export interface StoredTeam {
  name: string;
  worms: string[];
  flagb64?: string;
  synced: boolean | null;
}

export function getLocalTeams(): StoredTeam[] {
  const item = localStorage.getItem(WORMGINE_STORAGE_KEY_TEAMS);
  if (!item) {
    return [];
  }
  // TODO: Sanitize.
  return JSON.parse(item);
}
