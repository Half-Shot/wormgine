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

type GameReactChannelEvents = {
  goToMenu: (event: GoToMenuEvent) => void;
  closeWeaponMenu: () => void;
  openWeaponMenu: (weapons: AmmoCount) => void;
  weaponSelected: (code: IWeaponCode) => void;
  saveGameState: (callback: () => void) => void;
};

export class GameReactChannel extends (EventEmitter as new () => TypedEmitter<GameReactChannelEvents>) {
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

  public async saveGameState(): Promise<void> {
    return new Promise(resolve => this.emit("saveGameState", () => resolve()));
  }
}
