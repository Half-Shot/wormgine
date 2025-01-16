import { Assets } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Coordinate, MetersValue } from "../utils/coodinate";
import { GameStateOverlay } from "../overlays/gameStateOverlay";
import { StateRecorder } from "../state/recorder";
import { CameraLockPriority, ViewportCamera } from "../camera";
import { getAssets } from "../assets";
import { scenarioParser } from "../levels/scenarioParser";
import { WeaponTarget } from "../entities/phys/target";
import Logger from "../log";
import { logger } from "matrix-js-sdk/lib/logger";
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

  new GameStateOverlay(
    game.pixiApp.ticker,
    game.pixiApp.stage,
    gameState,
    world,
    game.viewport.screenWidth,
    game.viewport.screenHeight,
  );

  const waterLevel =
    level.objects.find((v) => v.type === "wormgine.water")?.tra.y ?? 0;

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
        Coordinate.fromScreen(levelObject.tra.x, levelObject.tra.y),
        parent,
      );
      world.addEntity(t);
      parent.addChild(t.sprite);
    }
  }

  player.on("gameState", (s) => {
    log.info("New game state recieved:", s.iteration);
    gameState.applyGameStateUpdate(s);
  });

  await gameInstance.ready();
  await gameInstance.allClientsReady();

  const gameHasStarted = gameInstance.gameStateImmediate.iteration > 0;

  if (gameInstance.isHost && !gameHasStarted) {
    await stateRecorder.writeHeader();
    log.info("All clients are ready! Beginning round");
    gameState.advanceRound();
    gameState.beginRound();
  } else if (!gameHasStarted) {
    await gameInstance.ready();
    log.info("Marked as ready");
  }

  if (gameInstance.isHost) {
    setInterval(() => {
      gameState.markAsFinished();
      gameState.advanceRound();
      gameState.beginRound();
    }, 3000);
  }

  log.info("Game can now begin");
}
