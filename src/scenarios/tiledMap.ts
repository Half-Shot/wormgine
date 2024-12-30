import { Ticker } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Worm } from "../entities/playable/worm";
import { Coordinate, MetersValue } from "../utils/coodinate";
import { GameState } from "../logic/gamestate";
import { GameStateOverlay } from "../overlays/gameStateOverlay";
import {
  GameDrawText,
  TeamWinnerText,
  templateRandomText,
} from "../text/toasts";
import { PhysicsEntity } from "../entities/phys/physicsEntity";
import {
  WeaponBazooka,
  WeaponFireworkLauncher,
  WeaponGrenade,
  WeaponHomingMissile,
  WeaponShotgun,
  WeaponMine,
} from "../weapons";
import staticController, { InputKind } from "../input";
import { StateRecorder } from "../state/recorder";
import { CameraLockPriority, ViewportCamera } from "../camera";
import { getAssets } from "../assets";
import { scenarioParser } from "../levels/scenarioParser";
import { WeaponTarget } from "../entities/phys/target";
import { WormSpawnRecordedState } from "../entities/state/wormSpawn";
import { InnerWormState } from "../entities/playable/wormState";

const weapons = [
  WeaponBazooka,
  WeaponGrenade,
  WeaponShotgun,
  WeaponFireworkLauncher,
  WeaponHomingMissile,
  WeaponMine,
];

export default async function runScenario(game: Game) {
  if (!game.level) {
    throw Error("Level required!");
  }
  const parent = game.viewport;
  const world = game.world;
  const { worldWidth } = game.viewport;

  const assets = getAssets();
  const level = await scenarioParser(game.level, assets.data, assets.textures);
  const bitmapPosition = Coordinate.fromScreen(
    level.terrain.x,
    level.terrain.y,
  );
  const terrain = BitmapTerrain.create(
    game.world,
    level.terrain.bitmap,
    bitmapPosition,
    level.terrain.destructible,
  );

  const gameState = new GameState(level.teams, world, level.rules);

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
      world,
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
    }
  }

  const wormInstances = new Map<string, Worm>();
  const spawnPositions = level.objects.filter(
    (v) => v.type === "wormgine.worm_spawn",
  ) as WormSpawnRecordedState[];
  for (const team of gameState.getActiveTeams()) {
    for (const wormInstance of team.worms) {
      const nextLocationIdx = spawnPositions.findIndex(
        (v) => v && v.teamGroup === wormInstance.team.group,
      );
      if (nextLocationIdx === -1) {
        throw Error("No location to spawn worm");
      }
      const nextLocation = spawnPositions[nextLocationIdx];
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
      delete spawnPositions[nextLocationIdx];
      wormInstances.set(wormInstance.uuid, wormEnt);
    }
  }

  let endOfRoundWaitDuration: number | null = null;
  let endOfGameFadeOut: number | null = null;
  let currentWorm: Worm | undefined;

  staticController.on("inputEnd", (kind: InputKind) => {
    if (!currentWorm?.currentState.canFire) {
      return;
    }
    if (kind === InputKind.WeaponMenu) {
      game.gameReactChannel.openWeaponMenu(
        currentWorm.wormIdent.team.availableWeapons,
      );
    } else if (kind === InputKind.PickTarget) {
      game.gameReactChannel.closeWeaponMenu();
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
  });

  function transitionHandler(prev: InnerWormState, next: InnerWormState) {
    if (next === InnerWormState.Getaway && prev === InnerWormState.Firing) {
      gameState.setTimer(5000);
    }
  }

  const roundHandlerFn = (dt: Ticker) => {
    gameState.update(dt);
    if (endOfGameFadeOut !== null) {
      endOfGameFadeOut -= dt.deltaMS;
      if (endOfGameFadeOut < 0) {
        game.pixiApp.ticker.remove(roundHandlerFn);
        game.goToMenu(gameState.getActiveTeams());
      }
      return;
    }
    if (currentWorm && currentWorm.currentState.active) {
      if (!gameState.isPreRound) {
        if (gameState.paused && currentWorm.currentState.timerShouldRun) {
          gameState.unpauseTimer();
        } else if (
          !gameState.paused &&
          !currentWorm.currentState.timerShouldRun
        ) {
          gameState.pauseTimer();
        }
      }
      if (gameState.isPreRound && currentWorm.hasPerformedAction) {
        gameState.playerMoved();
        return;
      } else if (!gameState.isPreRound && gameState.remainingRoundTime <= 0) {
        currentWorm?.onEndOfTurn();
        currentWorm = undefined;
        endOfRoundWaitDuration = null;
      } else {
        return;
      }
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
        currentWorm?.currentState.off("transition", transitionHandler);
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
      currentWorm.currentState.on("transition", transitionHandler);
      gameState.beginRound();
      endOfRoundWaitDuration = null;
      return;
    }
    endOfRoundWaitDuration -= dt.deltaMS;
  };

  game.pixiApp.ticker.add((dt) => camera.update(dt, currentWorm));

  game.pixiApp.ticker.add(roundHandlerFn);
  stateRecorder.recordGameStare();
  stateRecorder.syncEntityState();
}
