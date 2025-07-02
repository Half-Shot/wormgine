import type { Game } from "../game";
import { GameState } from "../logic/gamestate";
import { TeamGroup } from "../logic/teams";
import { GameStateOverlay } from "../overlays/gameStateOverlay";
import { DefaultWeaponSchema } from "../weapons/schema";
import { IWeaponCode } from "../weapons/weapon";

export default async function runScenario(game: Game) {
  const world = game.world;

  const gameState = new GameState(
    [
      {
        name: "The Prawns",
        group: TeamGroup.Red,
        worms: [
          {
            name: "Shrimp",
            maxHealth: 100,
            health: 100,
          },
        ],
        playerUserId: null,
        ammo: {
          [IWeaponCode.Bazooka]: 999,
        },
        uuid: "red",
      },
      {
        name: "The Whales",
        group: TeamGroup.Blue,
        worms: [
          {
            name: "Welsh boy",
            maxHealth: 100,
            health: 100,
          },
        ],
        playerUserId: null,
        ammo: {
          [IWeaponCode.Bazooka]: 999,
        },
        uuid: "blue",
      },
      {
        name: "Purple Rain",
        group: TeamGroup.Purple,
        worms: [
          {
            name: "Welsh boy",
            maxHealth: 100,
            health: 100,
          },
        ],
        playerUserId: null,
        ammo: {
          [IWeaponCode.Bazooka]: 999,
        },
        uuid: "purple",
      },
      {
        name: "The Yellow Raincoats",
        group: TeamGroup.Yellow,
        worms: [
          {
            name: "Welsh boy",
            maxHealth: 100,
            health: 100,
          },
        ],
        playerUserId: null,
        ammo: {
          [IWeaponCode.Bazooka]: 999,
        },
        uuid: "yellow",
      },
      {
        name: "The Onion Enjoyers",
        group: TeamGroup.Green,
        worms: [
          {
            name: "Welsh boy",
            maxHealth: 100,
            health: 100,
          },
        ],
        playerUserId: null,
        ammo: {
          [IWeaponCode.Bazooka]: 999,
        },
        uuid: "green",
      },
      {
        name: "Creamy Orange Grease Gang",
        group: TeamGroup.Orange,
        worms: [
          {
            name: "Welsh boy",
            maxHealth: 100,
            health: 100,
          },
        ],
        playerUserId: null,
        ammo: {
          [IWeaponCode.Bazooka]: 999,
        },
        uuid: "orange",
      },
    ],
    world,
    {
      winWhenOneGroupRemains: true,
      wormHealth: 100,
      ammoSchema: DefaultWeaponSchema,
    },
  );

  const overlay = new GameStateOverlay(
    game.pixiApp.ticker,
    game.pixiApp.stage,
    gameState,
    world,
    game.screenSize$,
  );

  let toastCounter = 0;
  do {
    overlay.toaster.pushToast(`This is toast #${++toastCounter}`, 5000);
    gameState.advanceRound();
    await new Promise((r) => setTimeout(r, 6000));
  } while (toastCounter < 50000);

  gameState.begin();
}
