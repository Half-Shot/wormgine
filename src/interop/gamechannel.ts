import EventEmitter from "events";
import TypedEmitter from "typed-emitter";
import type { Team } from "../logic/teams";
import type { IWeaponCode, IWeaponDefiniton } from "../weapons/weapon";

interface GoToMenuEvent {
  winningTeams?: Team[];
}

type GameReactChannelEvents = {
  goToMenu: (event: GoToMenuEvent) => void;
  openWeaponMenu: (weapons: IWeaponDefiniton[]) => void;
  weaponSelected: (code: IWeaponCode) => void;
};

export class GameReactChannel extends (EventEmitter as new () => TypedEmitter<GameReactChannelEvents>) {
  constructor() {
    super();
  }

  public goToMenu(winningTeams?: Team[]) {
    this.emit("goToMenu", { winningTeams });
  }

  public openWeaponMenu(weapons: IWeaponDefiniton[]) {
    this.emit("openWeaponMenu", weapons);
  }

  public weaponMenuSelect(code: IWeaponCode) {
    this.emit("weaponSelected", code);
  }
}
