import { Assets, Ticker } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Worm, WormState } from "../entities/playable/worm";
import { Coordinate, MetersValue } from "../utils/coodinate";
import { GameState } from "../logic/gamestate";
import { TeamGroup } from "../logic/teams";
import { GameStateOverlay } from "../overlays/gameStateOverlay";
import { GameDrawText, TeamWinnerText, templateRandomText } from "../text/toasts";

export default async function runScenario(game: Game) {
    const parent = game.viewport;
    const world = game.world;
    const { worldWidth, worldHeight } = game.viewport;

    const terrain = BitmapTerrain.create(
        worldWidth,
        worldHeight,
        game.world,
        Assets.get('testingGround')
    );

    const gameState = new GameState([{
        name: "The Prawns",
        group: TeamGroup.Red,
        worms: [{
            name: "Shrimp",
            maxHealth: 100,
            health: 100,
        }]
    },{
        name: "The Whales",
        group: TeamGroup.Blue,
        worms: [{
            name: "Welsh boy",
            maxHealth: 100,
            health: 100,
        }]
    }], {
        winWhenOneGroupRemains: true,
    });

    const bg = await world.addEntity(Background.create(game.viewport.screenWidth, game.viewport.screenHeight, game.viewport, [20, 21, 50, 35], terrain));
    await world.addEntity(terrain);
    bg.addToWorld(game.pixiApp.stage, parent);
    terrain.addToWorld(parent);

    const overlay = new GameStateOverlay(game.pixiApp.ticker, game.pixiApp.stage, gameState, world, game.viewport.screenWidth, game.viewport.screenHeight);

    const water = world.addEntity(
        new Water(
            MetersValue.fromPixels(worldWidth*4),
            MetersValue.fromPixels(worldHeight), 
        world)
    );    water.addToWorld(parent, world);

    const wormInstances = new Map<string, Worm>();

    let i = 300;
    for (const team of gameState.getActiveTeams()) {
        for (const wormInstance of team.worms) {
            i += 200;
            const wormEnt = world.addEntity(
                await Worm.create(parent, world, Coordinate.fromScreen(400 + i,105), wormInstance, async (worm, definition, opts) => {
                const newProjectile = definition.fireFn(parent, world, worm, opts);
                world.addEntity(newProjectile);
                return await newProjectile.onFireResult;
            }, overlay));
            wormInstances.set(wormInstance.uuid, wormEnt);
        }
    }

    let endOfRoundWaitDuration: number|null = null;
    let endOfGameFadeOut: number|null = null;
    let currentWorm: Worm|undefined;

    const roundHandlerFn = (dt: Ticker) => {
        if (endOfGameFadeOut !== null) {
            endOfGameFadeOut -= dt.deltaMS;
            if (endOfGameFadeOut < 0) {
                game.pixiApp.ticker.remove(roundHandlerFn);
                game.goToMenu({ winningTeams: gameState.getActiveTeams() });
            }
            return;
        }
        if (currentWorm && currentWorm.currentState !== WormState.Inactive) {
            return;
        }
        if (endOfRoundWaitDuration === null) {
            const nextState = gameState.advanceRound();
            console.log('advancing', nextState);
            if ('winningTeams' in nextState) {
                if (nextState.winningTeams.length) {
                    overlay.addNewToast(templateRandomText(TeamWinnerText, {
                        TeamName: nextState.winningTeams.map(t => t.name).join(', '),
                    }), 5000);
                } else {
                    // Draw
                    overlay.addNewToast(templateRandomText(GameDrawText), 5000);
                }
                endOfGameFadeOut = 5000;
            } else {
                currentWorm?.onEndOfTurn();
                currentWorm = wormInstances.get(nextState.nextWorm.uuid);
                // Turn just ended.
                endOfRoundWaitDuration = 5000;
                console.log(currentWorm);
            }
            return;
        }
        if (endOfRoundWaitDuration <= 0) {
            if (!currentWorm) {
                throw Error('Expected next worm');
            }
            currentWorm.onWormSelected();
            game.viewport.follow(currentWorm.sprite);
            endOfRoundWaitDuration = null;
            return;
        }
        endOfRoundWaitDuration -= dt.deltaMS;
    };

    game.pixiApp.ticker.add(roundHandlerFn);
}