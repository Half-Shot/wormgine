import useLocalStorageState from "use-local-storage-state";

export interface StoredTeam {
  name: string;
  worms: string[];
  flagb64?: string;
  lastModified: number;
  uuid: string;
}

export const DEFAULT_TEAMS: StoredTeam[] = [
  {
    name: "Good Boys",
    worms: ["Bone", "Squeaky Toy", "Breakfast", "Swishy"],
    lastModified: 0,
    uuid: crypto.randomUUID(),
  },
  {
    name: "Frosty",
    worms: ["Icicle", "Snowball", "Frostnibble", "Choc Ice"],
    lastModified: 0,
    uuid: crypto.randomUUID(),
  },
];

export const WORMGINE_STORAGE_KEY_TEAMS = "wormgine.teams";
export function useLocalTeamsHook() {
  return useLocalStorageState<StoredTeam[]>(WORMGINE_STORAGE_KEY_TEAMS, {
    defaultValue: () => [...DEFAULT_TEAMS],
  });
}

export function getLocalTeams(): StoredTeam[] {
  const item = localStorage.getItem(WORMGINE_STORAGE_KEY_TEAMS);
  const value = item ? JSON.parse(item) : "";
  if (!value?.length) {
    return [...DEFAULT_TEAMS];
  }
  return value;
  // TODO: Sanitize.
}
