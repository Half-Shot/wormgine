import { Assets, Text } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Mine } from "../entities/phys/mine";
import { Grenade } from "../entities/phys/grenade";
import { Coordinate, MetersValue } from "../utils/coodinate";
import staticController, { InputKind } from "../input";
import { GameState } from "../logic/gamestate";
import { TeamGroup } from "../logic/teams";
import { GameStateOverlay } from "../overlays/gameStateOverlay";
import { Firework } from "../entities/phys/firework";
import { DefaultTextStyle } from "../mixins/styles";

const weapons = ["grenade", "mine", "firework"];

export default async function runScenario(game: Game) {
  const parent = game.viewport;
  const world = game.world;
  const { worldWidth, worldHeight } = game.viewport;

  const terrain = BitmapTerrain.create(game.world, Assets.get("boneIsles"));

  const gameState = new GameState(
    [
      {
        name: "The Dummys",
        group: TeamGroup.Blue,
        worms: [
          {
            name: "Test Dolby",
            maxHealth: 100,
            health: 100,
          },
        ],
        playerUserId: null,
      },
    ],
    world,
  );

  new GameStateOverlay(
    game.pixiApp.ticker,
    game.pixiApp.stage,
    gameState,
    world,
    game.viewport.screenWidth,
    game.viewport.screenHeight,
  );

  const bg = await world.addEntity(
    Background.create(
      game.viewport.screenWidth,
      game.viewport.screenHeight,
      game.viewport,
      [20, 21, 50, 35],
      terrain,
    ),
  );
  await world.addEntity(terrain);
  bg.addToWorld(game.pixiApp.stage, parent);
  terrain.addToWorld(parent);

  const water = world.addEntity(
    new Water(
      MetersValue.fromPixels(worldWidth * 4),
      MetersValue.fromPixels(worldHeight),
      world,
    ),
  );
  water.addToWorld(game.viewport, world);

  world.addEntity(Mine.create(parent, world, Coordinate.fromScreen(900, 200)));

  let selectedWeaponIndex = 2;
  const weaponText = new Text({
    text: `Selected Weapon (press S to switch): ${weapons[selectedWeaponIndex]}`,
    style: DefaultTextStyle,
  });
  weaponText.position.set(20, 50);

  staticController.on("inputEnd", (kind: InputKind) => {
    if (kind !== InputKind.DebugSwitchWeapon) {
      return;
    }
    selectedWeaponIndex++;
    if (selectedWeaponIndex === weapons.length) {
      selectedWeaponIndex = 0;
    }
    weaponText.text = `Selected Weapon (press S to switch): ${weapons[selectedWeaponIndex]}`;
  });

  game.pixiApp.stage.addChild(weaponText);

  game.viewport.on("clicked", async (evt) => {
    const position = Coordinate.fromScreen(evt.world.x, evt.world.y);
    let entity;
    const wep = weapons[selectedWeaponIndex];
    if (wep === "grenade") {
      entity = Grenade.create(parent, world, position, { x: 0, y: 0 });
    } else if (wep === "mine") {
      entity = Mine.create(parent, world, position);
    } else if (wep === "firework") {
      entity = Firework.create(parent, world, position, { x: 0, y: 0 });
    } else {
      throw new Error("unknown weapon");
    }
    world.addEntity(entity);
  });
}
