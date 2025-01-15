import { Assets, Ticker } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { FireFn, Worm } from "../entities/playable/worm";
import { Coordinate, MetersValue } from "../utils/coodinate";
import { GameState } from "../logic/gamestate";
import { GameStateOverlay } from "../overlays/gameStateOverlay";
import {
  GameDrawText,
  TeamWinnerText,
  templateRandomText,
} from "../text/toasts";
import { PhysicsEntity } from "../entities/phys/physicsEntity";
import staticController, { InputKind } from "../input";
import { StateRecorder } from "../state/recorder";
import { CameraLockPriority, ViewportCamera } from "../camera";
import { getAssets } from "../assets";
import { scenarioParser } from "../levels/scenarioParser";
import { WeaponTarget } from "../entities/phys/target";
import { WormSpawnRecordedState } from "../entities/state/wormSpawn";
import { InnerWormState } from "../entities/playable/wormState";
import Logger from "../log";
import { RemoteWorm } from "../entities/playable/remoteWorm";
import { logger } from "matrix-js-sdk/lib/logger";
import { getDefinitionForCode } from "../weapons";
import { NetGameState } from "../net/netGameState";

const log = new Logger("scenario");

export default async function runScenario(game: Game) {
  if (!game.level) {
    throw Error("Level required!");
  }
  if (!game.netGameInstance) {
    throw Error("Network required!");
  }
  const gameInstance = game.netGameInstance;
  const parent = game.viewport;
  const world = game.world;
  const { worldWidth } = game.viewport;

  const player = gameInstance.player;
  player.on("started", () => {
    logger.info("started playback");
  });

  const wormInstances = new Map<string, Worm>();

  player.on("wormAction", (wormAction) => {
    const wormInst = wormInstances.get(wormAction.id);
    if (!wormInst) {
      throw Error("Worm not found");
    }
    if (wormInst instanceof RemoteWorm === false) {
      return;
    }
    wormInst.replayWormAction(wormAction.action);
  });

  player.on("wormSelectWeapon", (wormWeapon) => {
    const wormInst = wormInstances.get(wormWeapon.id);
    if (!wormInst) {
      throw Error("Worm not found");
    }
    if (wormInst instanceof RemoteWorm === false) {
      return;
    }
    wormInst.selectWeapon(getDefinitionForCode(wormWeapon.weapon));
  });

  player.on("wormActionAim", ({ id, dir, angle }) => {
    const wormInst = wormInstances.get(id);
    if (!wormInst) {
      throw Error("Worm not found");
    }
    if (wormInst instanceof RemoteWorm === false) {
      return;
    }
    wormInst.replayAim(dir, parseFloat(angle));
  });

  player.on("wormActionMove", ({ id, action, cycles }) => {
    const wormInst = wormInstances.get(id);
    if (!wormInst) {
      throw Error("Worm not found");
    }
    if (wormInst instanceof RemoteWorm === false) {
      return;
    }
    wormInst.replayMovement(action, cycles);
  });

  player.on("wormActionFire", ({ id, duration }) => {
    const wormInst = wormInstances.get(id);
    if (!wormInst) {
      throw Error("Worm not found");
    }
    if (wormInst instanceof RemoteWorm === false) {
      return;
    }
    wormInst.replayFire(duration);
  });

  let endOfRoundWaitDuration: number | null = null;
  let endOfGameFadeOut: number | null = null;
  let currentWorm: Worm | undefined;

  // function applyEntityData() {
  //   console.log("Applying entity state data");
  //   for (const ent of player.latestEntityData) {
  //     const existingEnt = world.entities.get(ent.uuid);
  //     if (!existingEnt) {
  //       throw new Error(
  //         `Ent ${ent.uuid} ${ent.type} was not found during entity sync`,
  //       );
  //     } else if (existingEnt instanceof PhysicsEntity === false) {
  //       throw new Error(
  //         `Ent ${ent.uuid} ${ent.type} was unexpectedly not a PhysicsEntity`,
  //       );
  //     }
  //     existingEnt.loadState(ent);
  //   }
  // }

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

  const initialTeams = gameInstance.gameStateImmediate.teams;

  for (const team of gameInstance.gameStateImmediate.teams) {
    if (team.flag) {
      Assets.add({ alias: `team-flag-${team.name}`, src: team.flag });
      await Assets.load(`team-flag-${team.name}`);
    }
  }

  const myUserId = gameInstance.myUserId;

  const stateLogger = new Logger("StateRecorder");
  const stateRecorder = new StateRecorder({
    async writeLine(data) {
      stateLogger.debug("Writing state", data);
      gameInstance.writeAction(data);
    },
  });
  const gameState = new NetGameState(
    initialTeams,
    world,
    gameInstance.rules,
    stateRecorder,
    gameInstance.myUserId,
  );

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

  const waterLevel = level.objects.find((v) => v.type === "wormgine.water")?.tra.y ?? 0;

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
          levelObject.tra.x,
          levelObject.tra.y,
        ),
        parent,
      );
      world.addEntity(t);
      parent.addChild(t.sprite);
    }
  }

  const spawnPositions = level.objects.filter(
    (v) => v.type === "wormgine.worm_spawn",
  ) as WormSpawnRecordedState[];
  for (const team of gameState.getActiveTeams()) {
    for (const wormInstance of team.worms) {
      log.info(
        `Spawning ${wormInstance.name} / ${wormInstance.team.name} / ${wormInstance.team.playerUserId} ${wormInstance.team.group}`,
        spawnPositions,
      );
      const nextLocationIdx = spawnPositions.findIndex(
        (v) => v && v.teamGroup === wormInstance.team.group,
      );
      if (nextLocationIdx === -1) {
        throw Error("No location to spawn worm");
      }
      const nextLocation = spawnPositions[nextLocationIdx];
      const pos = Coordinate.fromScreen(
        nextLocation.tra.x,
        nextLocation.tra.y,
      );
      const fireFn: FireFn = async (worm, definition, opts) => {
        const newProjectile = definition.fireFn(parent, world, worm, opts);
        if (newProjectile instanceof PhysicsEntity) {
          newProjectile.cameraLockPriority =
            CameraLockPriority.LockIfNotLocalPlayer;
          world.addEntity(newProjectile);
        }
        stateRecorder.syncEntityState(world);
        const res = await newProjectile.onFireResult;
        return res;
      };
      const wormEnt = world.addEntity(
        // TODO: For remote worms:
        //           async (worm, definition, opts) => {
        //   const newProjectile = definition.fireFn(parent, world, worm, opts);
        //   if (newProjectile instanceof PhysicsEntity) {
        //     parent.follow(newProjectile.sprite);
        //     world.addEntity(newProjectile);
        //   }
        //   applyEntityData();
        //   const res = await newProjectile.onFireResult;
        //   if (newProjectile instanceof PhysicsEntity) {
        //     parent.follow(worm.sprite);
        //   }
        //   applyEntityData();
        //   return res;
        // },
        wormInstance.team.playerUserId === myUserId
          ? Worm.create(
              parent,
              world,
              pos,
              wormInstance,
              fireFn,
              overlay.toaster,
              stateRecorder,
            )
          : RemoteWorm.create(
              parent,
              world,
              pos,
              wormInstance,
              fireFn,
              overlay.toaster,
            ),
      );
      delete spawnPositions[nextLocationIdx];
      wormInstances.set(wormInstance.uuid, wormEnt);
    }
  }

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
    const newWep = currentWorm.wormIdent.team.availableWeapons.find(
      ([w]) => w.code === code,
    );
    if (!newWep) {
      throw Error("Selected weapon is not owned by worm");
    }
    currentWorm.selectWeapon(newWep[0]);
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
      stateRecorder.syncEntityState(world);
      const nextState = gameState.advanceRound();
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

  if (gameInstance.isHost) {
    await gameInstance.allClientsReady();
    log.info("All clients are ready! Beginning round");
    game.pixiApp.ticker.add(roundHandlerFn);
  } else {
    await gameInstance.ready();
    log.info("Marked as ready");
    game.pixiApp.ticker.add((dt) => {
      gameState.update(dt);

      if (endOfRoundWaitDuration === null) {
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
    });
    player.on("gameState", (dataUpdate) => {
      const nextState = gameState.applyGameStateUpdate(dataUpdate);
      logger.info("New game state", dataUpdate, nextState);
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
    });
  }
}
