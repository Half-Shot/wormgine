import { Assets, Ticker } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { FireFn, Worm } from "../entities/playable/worm";
import { Coordinate, MetersValue } from "../utils/coodinate";
import { GameStateOverlay } from "../overlays/gameStateOverlay";
import {
  GameDrawText,
  TeamWinnerText,
  templateRandomText,
} from "../text/toasts";
import { PhysicsEntity } from "../entities/phys/physicsEntity";
import staticController, { InputKind } from "../input";
import { StateRecorder } from "../state/recorder";
import { ViewportCamera } from "../camera";
import { WeaponTarget } from "../entities/phys/target";
import { WormSpawnRecordedState } from "../entities/state/wormSpawn";
import { InnerWormState } from "../entities/playable/wormState";
import Logger from "../log";
import { RemoteWorm } from "../entities/playable/remoteWorm";
import { logger } from "matrix-js-sdk/lib/logger";
import { getDefinitionForCode } from "../weapons";
import { NetGameState } from "../net/netGameState";
import { NetGameWorld } from "../net/netGameWorld";
import { combineLatest, filter, map, Observable } from "rxjs";
import { RoundState } from "../logic/gamestate";
import { RunningNetGameInstance } from "../net/netgameinstance";
import { Mine } from "../entities/phys/mine";
import globalFlags from "../flags";
import { getAssets } from "../assets";

const log = new Logger("scenario");

interface HotReloadGameState {
  iteration: number;
}

export default async function runScenario(game: Game<HotReloadGameState>) {
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
  const wormInstances = new Map<string, Worm>();
  let currentWorm: Worm | undefined;

  const iteration = game.previousGameState?.iteration || 1;
  const iterField = game.overlay?.addTextField();
  if (iterField) {
    iterField.text = `Iteration: ${iteration}`;
  }

  game.gameReactChannel.on("saveGameState", (cb) => {
    cb({
      iteration: iteration + 1,
    } satisfies HotReloadGameState);
  });

  const stateRecorder = new StateRecorder({
    async writeLine(data) {
      stateLogger.debug("Writing state", data);
      gameInstance.writeAction(data);
    },
  });

  if (gameInstance instanceof RunningNetGameInstance) {
    const player = gameInstance.player;
    player.on("started", () => {
      logger.info("started playback");
    });

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

    player.on("wormActionFire", ({ id, opts }) => {
      const wormInst = wormInstances.get(id);
      if (!wormInst) {
        throw Error("Worm not found");
      }
      if (wormInst instanceof RemoteWorm === false) {
        return;
      }
      wormInst.replayFire(opts);
    });

    player.on("gameState", (s) => {
      log.info("New game state recieved:", s.iteration);
      gameState.applyGameStateUpdate(s);
    });
  }

  const level = game.netGameInstance.scenario;
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

  const initialTeams = gameInstance.gameConfigImmediate.teams!;

  for (const team of initialTeams) {
    if (team.flag) {
      Assets.add({ alias: `team-flag-${team.name}`, src: team.flag });
      await Assets.load(`team-flag-${team.name}`);
    }
  }

  const myUserId = gameInstance.myUserId;

  const stateLogger = new Logger("StateRecorder");
  const gameState = new NetGameState(
    initialTeams,
    world,
    gameInstance.gameConfigImmediate.rules,
    stateRecorder,
    gameInstance.myUserId,
  );

  const waterLevel = MetersValue.fromPixels(
    level.objects.find((v) => v.type === "wormgine.water")?.tra.y ?? 0,
  );

  const bg = await world.addEntity(
    new Background(
      game.screenSize$,
      game.viewport,
      terrain,
      world,
      (await getAssets()).textures.particles_cog,
      waterLevel,
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
    game.screenSize$,
  );

  const water = world.addEntity(
    new Water(MetersValue.fromPixels(worldWidth * 4), waterLevel, world),
  );
  water.addToWorld(parent, world);

  const camera = new ViewportCamera(
    game.viewport,
    new MetersValue(water.waterHeight.value + 2),
    world.physicsEntitySet$ as Observable<IteratorObject<PhysicsEntity>>,
    gameState.currentWorm$.pipe(map((w) => w?.team.playerUserId === null)),
  );

  const cameraTarget = game.overlay!.addTextField();
  camera.lockTarget.subscribe((target) => {
    cameraTarget.text = `Camera target: ${target?.toString() ?? "null"}`;
  });
  globalFlags.viewportCamera = camera;
  globalFlags.bindGameState(gameState);

  for (const levelObject of level.objects) {
    if (levelObject.type === "wormgine.target") {
      const t = new WeaponTarget(
        world,
        Coordinate.fromScreen(levelObject.tra.x, levelObject.tra.y),
        parent,
      );
      world.addEntity(t);
      parent.addChild(t.sprite);
    } else if (levelObject.type === "wormgine.mine") {
      const t = Mine.create(
        parent,
        world,
        Coordinate.fromScreen(levelObject.tra.x, levelObject.tra.y),
      );
      world.addEntity(t);
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
      const spawnPoint = spawnPositions.find(
        (s) => s.wormUuid === wormInstance.uuid,
      )?.tra;
      if (!spawnPoint) {
        throw Error("No location to spawn worm");
      }
      const pos = Coordinate.fromWorld(spawnPoint);
      const fireFn: FireFn = async (worm, definition, opts) => {
        const newProjectile = definition.fireFn(parent, world, worm, opts);
        if (newProjectile) {
          world.addEntity(newProjectile);
        }
      };
      const wormEnt = world.addEntity(
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
        wormInstance.uuid,
      );
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
    if (prev === InnerWormState.Idle && gameState.isPreRound) {
      gameState.playCurrentRound();
    }
    if (next === InnerWormState.Getaway && prev === InnerWormState.Firing) {
      gameState.setTimer(5000);
    }
  }

  const roundHandlerFn = (dt: Ticker) => {
    gameState.update(dt);
  };

  if (gameInstance instanceof RunningNetGameInstance) {
    if (gameInstance.isHost) {
      await gameInstance.ready();
      await gameInstance.allClientsReady();
      log.info("All clients are ready! Beginning round");
    } else {
      await gameInstance.ready();
      log.info("Marked as ready");
    }
  }
  gameState.begin();

  combineLatest([gameState.roundState$])
    .pipe(filter(([state]) => state === RoundState.Finished))
    .subscribe(() => {
      log.info("Round tick");
      wormInstances.forEach((w) => w.roundTick());
    });

  combineLatest([gameState.roundState$, gameState.remainingRoundTimeSeconds$])
    .pipe(filter(([state, _seconds]) => state === RoundState.Finished))
    .subscribe(() => {
      if (currentWorm) {
        log.info("Timer ran out");
        currentWorm.onEndOfTurn();
        currentWorm.currentState.off("transition", transitionHandler);
      }
    });

  const roundStateSub = combineLatest([
    gameState.roundState$,
    gameState.currentWorm$,
    world.entitiesMoving$,
  ])
    .pipe(
      filter(([roundState, worm]) => {
        if (roundState === RoundState.WaitingToBegin && !worm) {
          return false;
        }
        return true;
      }),
    )
    .subscribe(([roundState, worm, entsMoving]) => {
      world.setWind(gameState.currentWind);
      if (
        worm?.team.playerUserId === gameInstance.myUserId &&
        roundState === RoundState.Preround &&
        world instanceof NetGameWorld
      ) {
        world.setBroadcasting(true);
      } else if (
        roundState === RoundState.Finished &&
        world instanceof NetGameWorld
      ) {
        world.setBroadcasting(false);
      }
      if (
        worm === undefined &&
        roundState === RoundState.Finished &&
        gameInstance.isHost
      ) {
        log.info("Starting first round as worm was undefined");
        gameState.advanceRound();
        return;
      }
      if (roundState === RoundState.WaitingToBegin) {
        log.debug(
          "Round state worm diff",
          worm?.uuid,
          currentWorm?.wormIdent.uuid,
        );
        if (!worm) {
          throw Error("No worm in WaitingToBegin");
        }
        if (worm?.uuid === currentWorm?.wormIdent.uuid) {
          // New worm hasn't appeared yet.
          return;
        }
        currentWorm = wormInstances.get(worm.uuid);
        log.info("Setting next worm", worm.uuid, currentWorm);
        world.setWind(gameState.currentWind);
        currentWorm?.onWormSelected(true);
        currentWorm?.currentState.on("transition", transitionHandler);
        gameState.beginRound();
        return;
      } else if (roundState === RoundState.Finished && !entsMoving) {
        const nextState = gameState.advanceRound();
        if (nextState.toast) {
          overlay.toaster.pushToast(nextState.toast, 3500, undefined, true);
        }
        if ("winningTeams" in nextState) {
          if (nextState.winningTeams.length) {
            overlay.toaster.pushToast(
              templateRandomText(TeamWinnerText, {
                TeamName: nextState.winningTeams.map((t) => t.name).join(", "),
              }),
              8000,
            );
            game.pixiApp.ticker.remove(roundHandlerFn);
            roundStateSub.unsubscribe();
            let endOfGameFadeOut = 8000;
            game.pixiApp.ticker.add((dt) => {
              endOfGameFadeOut -= dt.deltaMS;
              if (endOfGameFadeOut < 0) {
                game.pixiApp.ticker.remove(roundHandlerFn);
                game.gameReactChannel.goToMenu({
                  winningTeams: gameState.getActiveTeams(),
                  teams: gameState.getTeams(),
                });
              }
            });
          } else {
            // Draw
            overlay.toaster.pushToast(templateRandomText(GameDrawText), 8000);
          }
        }
      }
    });

  game.pixiApp.ticker.add(roundHandlerFn);
  game.pixiApp.ticker.add(camera.update.bind(camera));
}
