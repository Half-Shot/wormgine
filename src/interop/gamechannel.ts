import EventEmitter from "events";
import TypedEmitter from "typed-emitter";
import type { Team } from "../logic/teams";
import type { IWeaponCode, IWeaponDefiniton } from "../weapons/weapon";

interface GoToMenuEvent {
  winDetails?: WinDetails;
}

interface WinDetails {
  winningTeams: Team[];
  teams: Team[];
}

export type AmmoCount = [IWeaponDefiniton, number][];

type GameReactChannelEvents = {
  goToMenu: (event: GoToMenuEvent) => void;
  closeWeaponMenu: () => void;
  openWeaponMenu: (weapons: AmmoCount) => void;
  weaponSelected: (code: IWeaponCode) => void;
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
}
