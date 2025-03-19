import { Assets, Text } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Mine } from "../entities/phys/mine";
import { Grenade } from "../entities/phys/grenade";
import { Coordinate, MetersValue } from "../utils/coodinate";
import { TestDummy } from "../entities/playable/testDummy";
import staticController, { InputKind } from "../input";
import { GameState } from "../logic/gamestate";
import { TeamGroup } from "../logic/teams";
import { GameStateOverlay } from "../overlays/gameStateOverlay";
import { Firework } from "../entities/phys/firework";
import { Worm } from "../entities/playable/worm";
import { DefaultTextStyle } from "../mixins/styles";
import { IWeaponCode } from "../weapons/weapon";
import { DefaultWeaponSchema } from "../weapons/schema";

const weapons = ["grenade", "mine", "firework"];

export default async function runScenario(game: Game) {
  const parent = game.viewport;
  const world = game.world;
  const { worldWidth, worldHeight } = game.viewport;

  const terrain = BitmapTerrain.create(game.world, Assets.get("terrain2"));

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
          {
            name: "Yeen #2",
            maxHealth: 100,
            health: 100,
          },
          {
            name: "Accident prone",
            maxHealth: 100,
            health: 100,
          },
        ],
        playerUserId: null,
        ammo: {
          [IWeaponCode.Bazooka]: 999,
        },
        uuid: "dummy",
      },
      {
        name: "The Invisible Duo",
        uuid: "invisible",
        group: TeamGroup.Red,
        worms: [
          {
            name: "Egg face",
            maxHealth: 100,
            health: 100,
          },
          {
            name: "Cream Guy",
            maxHealth: 100,
            health: 100,
          },
        ],
        playerUserId: null,
        ammo: {
          [IWeaponCode.Bazooka]: 999,
        },
      },
    ],
    world,
    {
      wormHealth: 100,
      winWhenOneGroupRemains: true,
      ammoSchema: DefaultWeaponSchema,
    },
  );

  new GameStateOverlay(
    game.pixiApp.ticker,
    game.pixiApp.stage,
    gameState,
    world,
    game.screenSize$,
  );

  const bg = await world.addEntity(
    Background.create(game.screenSize$, game.viewport, terrain, world),
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
  world.waterYPosition = water.body.translation().y;
  water.addToWorld(game.viewport, world);
  // const worm = world.addEntity(await Worm.create(parent, world, Coordinate.fromScreen(500,400), async (worm, definition, duration) => {
  //     const newProjectile = await definition.fireFn(parent, world, worm, duration);
  //     world.addEntity(newProjectile);
  // }));

  const [dummyteam, playerteam] = gameState.getActiveTeams();

  const dummy = world.addEntity(
    TestDummy.create(
      parent,
      world,
      Coordinate.fromScreen(650, 620),
      dummyteam.worms[0],
    ),
  );
  world.addEntity(
    TestDummy.create(
      parent,
      world,
      Coordinate.fromScreen(1500, 300),
      dummyteam.worms[1],
    ),
  );
  world.addEntity(
    TestDummy.create(
      parent,
      world,
      Coordinate.fromScreen(1012, 678),
      dummyteam.worms[2],
    ),
  );
  world.addEntity(
    Worm.create(
      parent,
      world,
      Coordinate.fromScreen(600, 550),
      playerteam.worms[0],
      async () => {
        return [];
      },
    ),
  );
  game.viewport.follow(dummy.sprite);

  world.addEntity(Mine.create(parent, world, Coordinate.fromScreen(900, 200)));

  let selectedWeaponIndex = 0;
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
