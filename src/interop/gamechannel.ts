import EventEmitter from "events";
import TypedEmitter from "typed-emitter";
import type { TeamDefinition } from "../logic/teams";
import type { IWeaponCode, IWeaponDefiniton } from "../weapons/weapon";

interface GoToMenuEvent {
  winDetails?: WinDetails;
}

interface WinDetails {
  winningTeams: TeamDefinition[];
  teams: TeamDefinition[];
}

export type AmmoCount = [IWeaponDefiniton, number][];

type GameReactChannelEvents<ReloadedGameState extends object> = {
  goToMenu: (event: GoToMenuEvent) => void;
  closeWeaponMenu: () => void;
  openWeaponMenu: (weapons: AmmoCount) => void;
  weaponSelected: (code: IWeaponCode) => void;
  saveGameState: (callback: (state: ReloadedGameState) => void) => void;
};

export class GameReactChannel<
  ReloadedGameState extends object = object,
> extends (EventEmitter as new () => TypedEmitter<
  GameReactChannelEvents<object>
>) {
  constructor() {
    super();
  }

  public goToMenu(winDetails?: WinDetails) {
    this.emit("goToMenu", { winDetails });
  }

  public openWeaponMenu(weapons: AmmoCount) {
    this.emit("openWeaponMenu", weapons);
  }

  public closeWeaponMenu() {
    this.emit("closeWeaponMenu");
  }

  public weaponMenuSelect(code: IWeaponCode) {
    this.emit("weaponSelected", code);
  }

  public async saveGameState(): Promise<ReloadedGameState> {
    return new Promise((resolve) =>
      this.emit("saveGameState", (state) =>
        resolve(state as ReloadedGameState),
      ),
    );
  }
}
