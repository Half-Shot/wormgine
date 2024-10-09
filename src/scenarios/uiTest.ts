import type { Game } from "../game";
import { Water } from "../entities/water";
import { MetersValue } from "../utils/coodinate";
import { GameState } from "../logic/gamestate";
import { TeamGroup } from "../logic/teams";
import { GameStateOverlay } from "../overlays/gameStateOverlay";

export default async function runScenario(game: Game) {
    const parent = game.viewport;
    const world = game.world;
    const { worldWidth, worldHeight } = game.viewport;

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

    const overlay = new GameStateOverlay(game.pixiApp.ticker, game.pixiApp.stage, gameState, world, game.viewport.screenWidth, game.viewport.screenHeight);

    // const water = world.addEntity(
    //     new Water(
    //         MetersValue.fromPixels(worldWidth*4),
    //         MetersValue.fromPixels(worldHeight), 
    //     world)
    // );
    // water.addToWorld(parent, world);
    

    let toastCounter = 0;
    do {
        overlay.toaster.pushToast(`This is toast #${++toastCounter}`, 5000);
        gameState.advanceRound();
        await new Promise(r => setTimeout(r, 6000));
    } while (true)
}