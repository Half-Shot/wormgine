import { Assets, Ticker } from "pixi.js";
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
import { TextStateReplay } from "../state/player";
import { RemoteWorm } from "../entities/playable/remoteWorm";
import { EntityType } from "../entities/type";
import { getDefinitionForCode } from "../weapons";

export default async function runScenario(game: Game) {
  const parent = game.viewport;
  const world = game.world;
  const { worldWidth, worldHeight } = game.viewport;

  const terrain = BitmapTerrain.create(game.world, Assets.get("testingGround"));

  const player = new TextStateReplay(replayData);
  player.on("started", () => {
    console.log("started playback");
  });

  const dataPromise = player.waitForFullGameState();
  player.play();

  const initialData = await dataPromise;

  const gameState = new GameState(initialData.gameState.teams, world, {
    // TODO: Rules.
    winWhenOneGroupRemains: true,
  });

  // TODO: Background
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
  await world.addEntity(terrain);
  bg.addToWorld(game.pixiApp.stage, parent);
  terrain.addToWorld(parent);

  const overlay = new GameStateOverlay(
    game.pixiApp.ticker,
    game.pixiApp.stage,
    gameState,
    world,
    game.viewport.screenWidth,
    game.viewport.screenHeight,
  );

  const water = world.addEntity(
    new Water(
      MetersValue.fromPixels(worldWidth * 4),
      MetersValue.fromPixels(worldHeight),
      world,
    ),
  );
  water.addToWorld(parent, world);

  const wormInstances = new Map<string, RemoteWorm>();

  player.on("wormAction", (wormAction) => {
    const wormInst = wormInstances.get(wormAction.id);
    if (!wormInst) {
      throw Error("Worm not found");
    }
    wormInst.replayWormAction(wormAction.action);
  });

  player.on("wormSelectWeapon", (wormWeapon) => {
    const wormInst = wormInstances.get(wormWeapon.id);
    if (!wormInst) {
      throw Error("Worm not found");
    }
    wormInst.selectWeapon(getDefinitionForCode(wormWeapon.weapon));
  });

  player.on("wormActionAim", ({ id, dir, angle }) => {
    const wormInst = wormInstances.get(id);
    if (!wormInst) {
      throw Error("Worm not found");
    }
    wormInst.replayAim(dir, parseFloat(angle));
  });

  player.on("wormActionMove", ({ id, action, cycles }) => {
    const wormInst = wormInstances.get(id);
    if (!wormInst) {
      throw Error("Worm not found");
    }
    wormInst.replayMovement(action, cycles);
  });

  player.on("wormActionFire", ({ id, duration }) => {
    const wormInst = wormInstances.get(id);
    if (!wormInst) {
      throw Error("Worm not found");
    }
    wormInst.replayFire(duration);
  });

  const worms = initialData.entitySync
    .filter((v) => v.type === EntityType.Worm)
    .reverse();

  for (const team of gameState.getActiveTeams()) {
    for (const wormInstance of team.worms) {
      const existingEntData = worms.pop()!;
      console.log("existing worm data", existingEntData);
      const wormEnt = world.addEntity(
        await RemoteWorm.create(
          parent,
          world,
          new Coordinate(
            parseFloat(existingEntData.tra.x),
            parseFloat(existingEntData.tra.y),
          ),
          wormInstance,
          async (worm, definition, opts) => {
            const newProjectile = definition.fireFn(parent, world, worm, opts);
            if (newProjectile instanceof PhysicsEntity) {
              parent.follow(newProjectile.sprite);
              world.addEntity(newProjectile);
            }
            applyEntityData();
            const res = await newProjectile.onFireResult;
            if (newProjectile instanceof PhysicsEntity) {
              parent.follow(worm.sprite);
            }
            applyEntityData();
            return res;
          },
          overlay.toaster,
        ),
        existingEntData.uuid,
      );
      wormInstances.set(wormInstance.uuid, wormEnt);
    }
  }

  let endOfRoundWaitDuration: number | null = null;
  let endOfGameFadeOut: number | null = null;
  let currentWorm: Worm | undefined;

  function applyEntityData() {
    console.log("Applying entity state data");
    for (const ent of player.latestEntityData) {
      const existingEnt = world.entities.get(ent.uuid);
      if (!existingEnt) {
        throw new Error(
          `Ent ${ent.uuid} ${ent.type} was not found during entity sync`,
        );
      } else if (existingEnt instanceof PhysicsEntity === false) {
        throw new Error(
          `Ent ${ent.uuid} ${ent.type} was unexpectedly not a PhysicsEntity`,
        );
      }
      existingEnt.loadState(ent);
    }
  }

  player.on("gameState", (dataUpdate) => {
    const nextState = gameState.applyGameStateUpdate(dataUpdate);
    applyEntityData();
    console.log("advancing round", nextState);
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
    if (currentWorm && currentWorm.currentState.active) {
      return;
    }
    if (endOfRoundWaitDuration === null) {
      return;
    }
    if (endOfRoundWaitDuration <= 0) {
      if (!currentWorm) {
        throw Error("Expected next worm");
      }
      world.setWind(gameState.currentWind);
      currentWorm.onWormSelected();
      game.viewport.follow(currentWorm.sprite);
      endOfRoundWaitDuration = null;
      return;
    }
    endOfRoundWaitDuration -= dt.deltaMS;
  };
  game.pixiApp.ticker.add(roundHandlerFn);
}

const replayData =
  `{"index":0,"data":{"version":2},"kind":0,"ts":"3939.836"}|{"index":1,"data":{"iteration":0,"wind":0,"teams":[{"name":"The Prawns","group":0,"playerUserId":null,"worms":[{"uuid":"9a3919e0-e756-428e-9ccb-094b4b012183","name":"Shrimp","health":100,"maxHealth":100}]},{"name":"The Whales","group":1,"playerUserId":null,"worms":[{"uuid":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","name":"Welsh boy","health":100,"maxHealth":100}]}]},"kind":7,"ts":"3946.394"}|{"index":2,"data":{"entities":[{"uuid":"55939cbf-e318-4a06-aa10-e9a228892a5a","type":0,"tra":{"x":"45","y":"5.25"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"9a3919e0-e756-428e-9ccb-094b4b012183"},{"uuid":"7165b582-f2df-49a8-8bed-25ff0c6cbb6c","type":0,"tra":{"x":"55","y":"5.25"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242"}]},"kind":1,"ts":"3946.562"}|{"index":3,"data":{"entities":[{"uuid":"55939cbf-e318-4a06-aa10-e9a228892a5a","type":0,"tra":{"x":"45","y":"5.3399248123168945"},"rot":"0","vel":{"x":"0","y":"1.3079999685287476"},"wormIdent":"9a3919e0-e756-428e-9ccb-094b4b012183"},{"uuid":"7165b582-f2df-49a8-8bed-25ff0c6cbb6c","type":0,"tra":{"x":"55","y":"5.3399248123168945"},"rot":"0","vel":{"x":"0","y":"1.3079999685287476"},"wormIdent":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242"}]},"kind":1,"ts":"3951.805"}|{"index":4,"data":{"iteration":0,"wind":3,"teams":[{"name":"The Prawns","group":0,"playerUserId":null,"worms":[{"uuid":"9a3919e0-e756-428e-9ccb-094b4b012183","name":"Shrimp","health":100,"maxHealth":100}]},{"name":"The Whales","group":1,"playerUserId":null,"worms":[{"uuid":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","name":"Welsh boy","health":100,"maxHealth":100}]}]},"kind":7,"ts":"3951.903"}|{"index":5,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":100,"action":0},"kind":3,"ts":"13566.692"}|{"index":6,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"3.6415926535897936","dir":"up","action":2},"kind":4,"ts":"13857.656"}|{"index":7,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":24,"action":1},"kind":3,"ts":"14179.635"}|{"index":8,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"0.12000000000000001","dir":"down","action":2},"kind":4,"ts":"16613.708"}|{"index":9,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"5.323185307179607","dir":"up","action":2},"kind":4,"ts":"17098.375"}|{"index":10,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"5.983185307179593","dir":"down","action":2},"kind":4,"ts":"17519.758"}|{"index":11,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"0.02","dir":"down","action":2},"kind":4,"ts":"17839.937"}|{"index":12,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"5.863185307179595","dir":"up","action":2},"kind":4,"ts":"18100.703"}|{"index":13,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","weapon":0},"kind":6,"ts":"18139.988"}|{"index":14,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"5.16318530717961","dir":"up","action":2},"kind":4,"ts":"18615.055"}|{"index":15,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","duration":27.959999999999955,"action":3},"kind":5,"ts":"19278.808"}|{"index":16,"data":{"entities":[{"uuid":"55939cbf-e318-4a06-aa10-e9a228892a5a","type":0,"tra":{"x":"43.098121643066406","y":"6.4760661125183105"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"9a3919e0-e756-428e-9ccb-094b4b012183"},{"uuid":"7165b582-f2df-49a8-8bed-25ff0c6cbb6c","type":0,"tra":{"x":"55","y":"6.476071834564209"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242"},{"uuid":"cdff34b1-cdbe-4be3-82dc-03fe11b6c572","timer":180,"owner":"9a3919e0-e756-428e-9ccb-094b4b012183","timerSecs":3,"type":1,"tra":{"x":"44.62083053588867","y":"6.176065921783447"},"rot":"0","vel":{"x":"5.321871757507324","y":"-10.994749069213867"}}]},"kind":1,"ts":"19280.034"}|{"index":17,"data":{"entities":[]},"kind":1,"ts":"22336.575"}|{"index":18,"data":{"iteration":1,"wind":2,"teams":[{"name":"The Prawns","group":0,"playerUserId":null,"worms":[{"uuid":"9a3919e0-e756-428e-9ccb-094b4b012183","name":"Shrimp","health":100,"maxHealth":100}]},{"name":"The Whales","group":1,"playerUserId":null,"worms":[{"uuid":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","name":"Welsh boy","health":100,"maxHealth":100}]}]},"kind":7,"ts":"22336.731"}|{"index":19,"data":{"id":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","cycles":19,"action":0},"kind":3,"ts":"28405.955"}|{"index":20,"data":{"id":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","angle":"3.3815926535897933","dir":"up","action":2},"kind":4,"ts":"28954.054"}|{"index":21,"data":{"id":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","duration":29.039999999999953,"action":3},"kind":5,"ts":"31201.008"}|{"index":22,"data":{"entities":[{"uuid":"7165b582-f2df-49a8-8bed-25ff0c6cbb6c","type":0,"tra":{"x":"54.526031494140625","y":"6.4760661125183105"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242"},{"uuid":"0f6d3da6-fb15-443f-b2c5-8ad51ece502d","timer":1800,"owner":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","timerSecs":30,"type":2,"tra":{"x":"51.41943359375","y":"5.9760661125183105"},"rot":"0","vel":{"x":"-14.90359878540039","y":"-2.4314396381378174"}}]},"kind":1,"ts":"31202.144"}|{"index":23,"data":{"entities":[{"uuid":"55939cbf-e318-4a06-aa10-e9a228892a5a","type":0,"tra":{"x":"43.006202697753906","y":"6.541950702667236"},"rot":"0","vel":{"x":"-1.3786027431488037","y":"1.2948399782180786"},"wormIdent":"9a3919e0-e756-428e-9ccb-094b4b012183"}]},"kind":1,"ts":"31610.144"}|{"index":24,"data":{"iteration":3,"wind":-4,"teams":[{"name":"The Prawns","group":0,"playerUserId":null,"worms":[{"uuid":"9a3919e0-e756-428e-9ccb-094b4b012183","name":"Shrimp","health":69,"maxHealth":100}]},{"name":"The Whales","group":1,"playerUserId":null,"worms":[{"uuid":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","name":"Welsh boy","health":100,"maxHealth":100}]}]},"kind":7,"ts":"31610.292"}|{"index":25,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":53,"action":1},"kind":3,"ts":"37177.894"}|{"index":26,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":0,"action":1},"kind":3,"ts":"37269.168"}|{"index":27,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":0,"action":1},"kind":3,"ts":"37732.093"}|{"index":28,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":66,"action":0},"kind":3,"ts":"38115.122"}|{"index":29,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":66,"action":0},"kind":3,"ts":"38415.036"}|{"index":30,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":0,"action":1},"kind":3,"ts":"38433.039"}|{"index":31,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":0,"action":1},"kind":3,"ts":"38437.593"}|{"index":32,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","action":4},"kind":2,"ts":"38626.191"}|{"index":33,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":216,"action":0},"kind":3,"ts":"40563.095"}|{"index":34,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":11,"action":1},"kind":3,"ts":"40810.796"}|{"index":35,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"5.563185307179602","dir":"down","action":2},"kind":4,"ts":"41470.206"}|{"index":36,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"5.123185307179611","dir":"up","action":2},"kind":4,"ts":"43925.224"}|{"index":37,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","duration":28.49999999999995,"action":3},"kind":5,"ts":"44867.26"}|{"index":38,"data":{"entities":[{"uuid":"55939cbf-e318-4a06-aa10-e9a228892a5a","type":0,"tra":{"x":"31.91230010986328","y":"6.4760661125183105"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"9a3919e0-e756-428e-9ccb-094b4b012183"},{"uuid":"b85b4a20-26cf-45ae-98cb-16e81a9dbf89","timer":240,"owner":"9a3919e0-e756-428e-9ccb-094b4b012183","timerSecs":4,"type":1,"tra":{"x":"33.33494567871094","y":"6.176065921783447"},"rot":"0","vel":{"x":"5.068180084228516","y":"-11.635520935058594"}}]},"kind":1,"ts":"44868.576"}|{"index":39,"data":{"entities":[{"uuid":"7165b582-f2df-49a8-8bed-25ff0c6cbb6c","type":0,"tra":{"x":"54.829036712646484","y":"6.479506492614746"},"rot":"0","vel":{"x":"1.9895514249801636","y":"0.4295259714126587"},"wormIdent":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242"}]},"kind":1,"ts":"48936.236"}|{"index":40,"data":{"iteration":5,"wind":-10,"teams":[{"name":"The Prawns","group":0,"playerUserId":null,"worms":[{"uuid":"9a3919e0-e756-428e-9ccb-094b4b012183","name":"Shrimp","health":69,"maxHealth":100}]},{"name":"The Whales","group":1,"playerUserId":null,"worms":[{"uuid":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","name":"Welsh boy","health":71,"maxHealth":100}]}]},"kind":7,"ts":"48936.392"}|{"index":41,"data":{"id":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","angle":"3.8215926535897937","dir":"up","action":2},"kind":4,"ts":"55217.401"}|{"index":42,"data":{"id":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","duration":36.299999999999955,"action":3},"kind":5,"ts":"56594.373"}|{"index":43,"data":{"entities":[{"uuid":"7165b582-f2df-49a8-8bed-25ff0c6cbb6c","type":0,"tra":{"x":"55.38034439086914","y":"6.947047233581543"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242"},{"uuid":"0cc99087-d69f-4d45-bc79-17171980db99","timer":1800,"owner":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","timerSecs":30,"type":2,"tra":{"x":"52.372928619384766","y":"6.447047233581543"},"rot":"0","vel":{"x":"-17.447668075561523","y":"-9.406169891357422"}}]},"kind":1,"ts":"56596.217"}|{"index":44,"data":{"entities":[{"uuid":"0cc99087-d69f-4d45-bc79-17171980db99","timer":0,"owner":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","timerSecs":30,"type":2,"tra":{"x":"-108.63345336914062","y":"47.79460906982422"},"rot":"2.7007789611816406","vel":{"x":"-60.218833923339844","y":"28.409711837768555"}}]},"kind":1,"ts":"59306.059"}|{"index":45,"data":{"iteration":6,"wind":-3,"teams":[{"name":"The Prawns","group":0,"playerUserId":null,"worms":[{"uuid":"9a3919e0-e756-428e-9ccb-094b4b012183","name":"Shrimp","health":69,"maxHealth":100}]},{"name":"The Whales","group":1,"playerUserId":null,"worms":[{"uuid":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","name":"Welsh boy","health":71,"maxHealth":100}]}]},"kind":7,"ts":"59306.182"}|{"index":46,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"5.483185307179603","dir":"down","action":2},"kind":4,"ts":"65216.52"}|{"index":47,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","duration":27.779999999999955,"action":3},"kind":5,"ts":"66294.166"}|{"index":48,"data":{"entities":[{"uuid":"72ff6276-1d6b-4675-b37b-266b79290b2c","timer":240,"owner":"9a3919e0-e756-428e-9ccb-094b4b012183","timerSecs":4,"type":1,"tra":{"x":"34.33161544799805","y":"6.176065921783447"},"rot":"0","vel":{"x":"8.401067733764648","y":"-8.650063514709473"}}]},"kind":1,"ts":"66294.701"}|{"index":49,"data":{"entities":[{"uuid":"7165b582-f2df-49a8-8bed-25ff0c6cbb6c","type":0,"tra":{"x":"55.69258499145508","y":"6.912735462188721"},"rot":"0","vel":{"x":"-5.8586010709404945e-8","y":"0.21543896198272705"},"wormIdent":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242"}]},"kind":1,"ts":"70338.791"}|{"index":50,"data":{"iteration":8,"wind":-10,"teams":[{"name":"The Prawns","group":0,"playerUserId":null,"worms":[{"uuid":"9a3919e0-e756-428e-9ccb-094b4b012183","name":"Shrimp","health":69,"maxHealth":100}]},{"name":"The Whales","group":1,"playerUserId":null,"worms":[{"uuid":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","name":"Welsh boy","health":60,"maxHealth":100}]}]},"kind":7,"ts":"70338.933"}|{"index":51,"data":{"id":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","weapon":2},"kind":6,"ts":"76609.55"}|{"index":52,"data":{"id":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","weapon":1},"kind":6,"ts":"77290.666"}|{"index":53,"data":{"id":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","duration":18.959999999999997,"action":3},"kind":5,"ts":"78094.748"}|{"index":54,"data":{"entities":[{"uuid":"7165b582-f2df-49a8-8bed-25ff0c6cbb6c","type":0,"tra":{"x":"55.683189392089844","y":"6.952401161193848"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242"},{"uuid":"8a2b33ff-9c75-4751-84f4-7bebb6239076","timer":1800,"owner":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","timerSecs":30,"type":2,"tra":{"x":"54.19084167480469","y":"6.452401161193848"},"rot":"0","vel":{"x":"-4.29625940322876","y":"-2.316145896911621"}}]},"kind":1,"ts":"78096.702"}|{"index":55,"data":{"entities":[]},"kind":1,"ts":"78594.493"}|{"index":56,"data":{"iteration":9,"wind":-4,"teams":[{"name":"The Prawns","group":0,"playerUserId":null,"worms":[{"uuid":"9a3919e0-e756-428e-9ccb-094b4b012183","name":"Shrimp","health":69,"maxHealth":100}]},{"name":"The Whales","group":1,"playerUserId":null,"worms":[{"uuid":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","name":"Welsh boy","health":60,"maxHealth":100}]}]},"kind":7,"ts":"78594.645"}|{"index":57,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"5.883185307179595","dir":"down","action":2},"kind":4,"ts":"84118.353"}|{"index":58,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"6.263185307179587","dir":"down","action":2},"kind":4,"ts":"84447.741"}|{"index":59,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":24,"action":1},"kind":3,"ts":"84872.747"}|{"index":60,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","action":4},"kind":2,"ts":"84994.826"}|{"index":61,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":137,"action":1},"kind":3,"ts":"86407.776"}|{"index":62,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","action":4},"kind":2,"ts":"86544.828"}|{"index":63,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":67,"action":1},"kind":3,"ts":"87701.747"}|{"index":64,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":6,"action":1},"kind":3,"ts":"87760.094"}|{"index":65,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","cycles":41,"action":1},"kind":3,"ts":"88140.772"}|{"index":66,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","weapon":0},"kind":6,"ts":"88598.485"}|{"index":67,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","weapon":2},"kind":6,"ts":"89069.803"}|{"index":68,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"0.27999999999999997","dir":"down","action":2},"kind":4,"ts":"90286.762"}|{"index":69,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","angle":"0.019999999999999993","dir":"up","action":2},"kind":4,"ts":"91005.665"}|{"index":70,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","duration":0,"action":3},"kind":5,"ts":"92014.813"}|{"index":71,"data":{"entities":[{"uuid":"55939cbf-e318-4a06-aa10-e9a228892a5a","type":0,"tra":{"x":"46.71908950805664","y":"6.518653869628906"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"9a3919e0-e756-428e-9ccb-094b4b012183"},{"uuid":"7165b582-f2df-49a8-8bed-25ff0c6cbb6c","type":0,"tra":{"x":"55.683189392089844","y":"6.952401161193848"},"rot":"0","vel":{"x":"0.8804620504379272","y":"0.5019922852516174"},"wormIdent":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242"}]},"kind":1,"ts":"92074.706"}|{"index":72,"data":{"entities":[{"uuid":"7165b582-f2df-49a8-8bed-25ff0c6cbb6c","type":0,"tra":{"x":"55.694698333740234","y":"6.906276226043701"},"rot":"0","vel":{"x":"0.22071585059165955","y":"0"},"wormIdent":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242"}]},"kind":1,"ts":"92077.909"}|{"index":73,"data":{"iteration":11,"wind":3,"teams":[{"name":"The Prawns","group":0,"playerUserId":null,"worms":[{"uuid":"9a3919e0-e756-428e-9ccb-094b4b012183","name":"Shrimp","health":69,"maxHealth":100}]},{"name":"The Whales","group":1,"playerUserId":null,"worms":[{"uuid":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","name":"Welsh boy","health":35,"maxHealth":100}]}]},"kind":7,"ts":"92078.071"}|{"index":74,"data":{"id":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","cycles":16,"action":0},"kind":3,"ts":"97635.973"}|{"index":75,"data":{"id":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","angle":"3.5415926535897935","dir":"down","action":2},"kind":4,"ts":"98789.926"}|{"index":76,"data":{"id":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","angle":"3.181592653589793","dir":"down","action":2},"kind":4,"ts":"99194.973"}|{"index":77,"data":{"id":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","duration":45.239999999999995,"action":3},"kind":5,"ts":"100522.604"}|{"index":78,"data":{"entities":[{"uuid":"7165b582-f2df-49a8-8bed-25ff0c6cbb6c","type":0,"tra":{"x":"55.269622802734375","y":"7.552298069000244"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242"},{"uuid":"3e42877e-8537-4539-9640-a8d0d6dca372","timer":1800,"owner":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","timerSecs":30,"type":2,"tra":{"x":"50.74505615234375","y":"7.052298069000244"},"rot":"0","vel":{"x":"-30.73215103149414","y":"-0.8199613690376282"}}]},"kind":1,"ts":"100523.866"}|{"index":79,"data":{"entities":[{"uuid":"55939cbf-e318-4a06-aa10-e9a228892a5a","type":0,"tra":{"x":"46.614994049072266","y":"6.458955764770508"},"rot":"0","vel":{"x":"-1.0410246849060059","y":"-0.12692099809646606"},"wormIdent":"9a3919e0-e756-428e-9ccb-094b4b012183"}]},"kind":1,"ts":"100676.134"}|{"index":80,"data":{"iteration":13,"wind":2,"teams":[{"name":"The Prawns","group":0,"playerUserId":null,"worms":[{"uuid":"9a3919e0-e756-428e-9ccb-094b4b012183","name":"Shrimp","health":29,"maxHealth":100}]},{"name":"The Whales","group":1,"playerUserId":null,"worms":[{"uuid":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","name":"Welsh boy","health":35,"maxHealth":100}]}]},"kind":7,"ts":"100676.345"}|{"index":81,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","weapon":1},"kind":6,"ts":"107131.033"}|{"index":82,"data":{"id":"9a3919e0-e756-428e-9ccb-094b4b012183","duration":80.27999999999977,"action":3},"kind":5,"ts":"109001.501"}|{"index":83,"data":{"entities":[{"uuid":"55939cbf-e318-4a06-aa10-e9a228892a5a","type":0,"tra":{"x":"46.07716751098633","y":"7.702179908752441"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"9a3919e0-e756-428e-9ccb-094b4b012183"},{"uuid":"c4b9767b-6305-401e-829a-1ddebfade691","timer":1800,"owner":"9a3919e0-e756-428e-9ccb-094b4b012183","timerSecs":30,"type":2,"tra":{"x":"52.32472229003906","y":"7.202179908752441"},"rot":"0","vel":{"x":"58.55965805053711","y":"0.7808995246887207"}}]},"kind":1,"ts":"109003.155"}|{"index":84,"data":{"entities":[{"uuid":"7165b582-f2df-49a8-8bed-25ff0c6cbb6c","type":0,"tra":{"x":"55.271026611328125","y":"7.579299449920654"},"rot":"0","vel":{"x":"0.08451084792613983","y":"1.6814192533493042"},"wormIdent":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242"}]},"kind":1,"ts":"109057.754"}|{"index":85,"data":{"iteration":15,"wind":0,"teams":[{"name":"The Prawns","group":0,"playerUserId":null,"worms":[{"uuid":"9a3919e0-e756-428e-9ccb-094b4b012183","name":"Shrimp","health":29,"maxHealth":100}]},{"name":"The Whales","group":1,"playerUserId":null,"worms":[{"uuid":"d39e19a9-f8e5-4c2a-b4dc-eecb2d741242","name":"Welsh boy","health":0,"maxHealth":100}]}]},"kind":7,"ts":"109057.95"}`.split(
    "|",
  );
