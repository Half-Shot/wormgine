import { Ticker, Text } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Worm, WormState } from "../entities/playable/worm";
import { Coordinate, MetersValue } from "../utils/coodinate";
import { GameState } from "../logic/gamestate";
import { TeamGroup } from "../logic/teams";
import { GameStateOverlay } from "../overlays/gameStateOverlay";
import {
  GameDrawText,
  TeamWinnerText,
  templateRandomText,
} from "../text/toasts";
import { PhysicsEntity } from "../entities/phys/physicsEntity";
import { DefaultTextStyle } from "../mixins/styles";
import {
  WeaponBazooka,
  WeaponFireworkLauncher,
  WeaponGrenade,
  WeaponHomingMissile,
  WeaponShotgun,
} from "../weapons";
import staticController, { InputKind } from "../input";
import { IWeaponCode } from "../weapons/weapon";
import { StateRecorder } from "../state/recorder";
import { CameraLockPriority, ViewportCamera } from "../camera";
import { getAssets } from "../assets";
import { scenarioParser } from "../levels/scenarioParser";
import { WeaponTarget } from "../entities/phys/target";

const weapons = [
  WeaponBazooka,
  WeaponGrenade,
  WeaponShotgun,
  WeaponFireworkLauncher,
  WeaponHomingMissile,
];

export default async function runScenario(game: Game) {
  const parent = game.viewport;
  const world = game.world;
  const { worldWidth } = game.viewport;

  const assets = getAssets();
  const level = await scenarioParser(assets.data);
  const bitmapPosition = Coordinate.fromScreen(
    level.terrain.x,
    level.terrain.y,
  );
  const terrain = BitmapTerrain.create(
    game.world,
    // TODO: Autoload from map.
    assets.textures["training"],
    bitmapPosition,
  );

  console.log(level.rules);

  // TODO: Determine from state?
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
      },
    ],
    world,
    level.rules,
  );

  const recordedGameplayKey = `wormgine_recorded_${new Date().toISOString()}`;
  let recordedState = "";

  const stateRecorder = new StateRecorder(world, gameState, {
    async writeLine(data) {
      recordedState += `${JSON.stringify(data)}|`;
      localStorage.setItem(recordedGameplayKey, recordedState);
    },
  });

  const bg = await world.addEntity(
    Background.create(
      game.viewport.screenWidth,
      game.viewport.screenHeight,
      game.viewport,
      [20, 21, 50, 35],
      terrain,
    ),
  );
  bg.addToWorld(game.pixiApp.stage, parent);
  world.addEntity(terrain);
  terrain.addToWorld(parent);

  const overlay = new GameStateOverlay(
    game.pixiApp.ticker,
    game.pixiApp.stage,
    gameState,
    world,
    game.viewport.screenWidth,
    game.viewport.screenHeight,
  );

  const waterLevel = parseFloat(
    level.objects.find((v) => v.type === "wormgine.water")?.tra.y ?? "0",
  );

  const water = world.addEntity(
    new Water(
      MetersValue.fromPixels(worldWidth * 4),
      MetersValue.fromPixels(waterLevel),
      world,
    ),
  );
  water.addToWorld(parent, world);

  const camera = new ViewportCamera(game.viewport, world, water.waterHeight);
  console.log(bitmapPosition.toScreenPoint());
  camera.snapToPosition(
    bitmapPosition.toScreenPoint(),
    CameraLockPriority.SuggestedLockNonLocal,
    false,
  );

  for (const levelObject of level.objects) {
    if (levelObject.type === "wormgine.target") {
      const t = new WeaponTarget(
        world,
        Coordinate.fromScreen(
          parseFloat(levelObject.tra.x),
          parseFloat(levelObject.tra.y),
        ),
        parent,
      );
      world.addEntity(t);
      parent.addChild(t.sprite);
      console.log("Added target");
    }
  }

  const wormInstances = new Map<string, Worm>();
  for (const team of gameState.getActiveTeams()) {
    for (const wormInstance of team.worms) {
      const nextLocation = level.objects.find(
        (v) => v.type === "wormgine.worm_spawn",
      );
      if (!nextLocation) {
        throw Error("No location to spawn worm");
      }
      const wormEnt = world.addEntity(
        await Worm.create(
          parent,
          world,
          Coordinate.fromScreen(
            parseFloat(nextLocation.tra.x),
            parseFloat(nextLocation.tra.y),
          ),
          wormInstance,
          async (worm, definition, opts) => {
            const newProjectile = definition.fireFn(parent, world, worm, opts);
            if (newProjectile instanceof PhysicsEntity) {
              newProjectile.cameraLockPriority =
                CameraLockPriority.LockIfNotLocalPlayer;
              world.addEntity(newProjectile);
            }
            stateRecorder.syncEntityState();
            const res = await newProjectile.onFireResult;
            return res;
          },
          overlay.toaster,
          stateRecorder,
        ),
      );
      wormInstances.set(wormInstance.uuid, wormEnt);
    }
  }

  let endOfRoundWaitDuration: number | null = null;
  let endOfGameFadeOut: number | null = null;
  let currentWorm: Worm | undefined;

  const weaponText = new Text({
    text: `Selected Weapon: no-worm-selected`,
    style: DefaultTextStyle,
  });
  weaponText.position.set(20, 50);
  staticController.on("inputEnd", (kind: InputKind) => {
    if (currentWorm?.currentState !== WormState.Idle) {
      return;
    }
    if (kind === InputKind.WeaponMenu) {
      game.gameReactChannel.openWeaponMenu(weapons);
    }
  });

  game.gameReactChannel.on("weaponSelected", (code) => {
    if (!currentWorm) {
      return;
    }
    const newWep = weapons.findIndex((w) => w.code === code);
    if (newWep === -1) {
      throw Error("Selected weapon is not owned by worm");
    }
    currentWorm.selectWeapon(weapons[newWep]);
    weaponText.text = `Selected Weapon: ${IWeaponCode[currentWorm.weapon.code]}`;
  });

  const roundHandlerFn = (dt: Ticker) => {
    if (endOfGameFadeOut !== null) {
      endOfGameFadeOut -= dt.deltaMS;
      if (endOfGameFadeOut < 0) {
        game.pixiApp.ticker.remove(roundHandlerFn);
        game.goToMenu(gameState.getActiveTeams());
      }
      return;
    }
    if (currentWorm && currentWorm.currentState !== WormState.Inactive) {
      return;
    }
    if (endOfRoundWaitDuration === null) {
      stateRecorder.syncEntityState();
      const nextState = gameState.advanceRound();
      stateRecorder.recordGameStare();
      if ("winningTeams" in nextState) {
        if (nextState.winningTeams.length) {
          overlay.toaster.pushToast(
            templateRandomText(TeamWinnerText, {
              TeamName: nextState.winningTeams.map((t) => t.name).join(", "),
            }),
            8000,
          );
        } else {
          // Draw
          overlay.toaster.pushToast(templateRandomText(GameDrawText), 8000);
        }
        endOfGameFadeOut = 8000;
      } else {
        currentWorm?.onEndOfTurn();
        currentWorm = wormInstances.get(nextState.nextWorm.uuid);
        // Turn just ended.
        endOfRoundWaitDuration = 5000;
      }
      return;
    }
    if (endOfRoundWaitDuration <= 0) {
      if (!currentWorm) {
        throw Error("Expected next worm");
      }
      world.setWind(gameState.currentWind);
      currentWorm.onWormSelected();
      weaponText.text = `Selected Weapon: ${IWeaponCode[currentWorm.weapon.code]}`;
      endOfRoundWaitDuration = null;
      return;
    }
    endOfRoundWaitDuration -= dt.deltaMS;
  };

  game.pixiApp.ticker.add((dt) => camera.update(dt, currentWorm));

  game.pixiApp.ticker.add(roundHandlerFn);
  game.pixiApp.stage.addChild(weaponText);
  stateRecorder.recordGameStare();
  stateRecorder.syncEntityState();
}
