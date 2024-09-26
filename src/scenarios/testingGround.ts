import { Assets } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Grenade } from "../entities/phys/grenade";
import { Worm } from "../entities/playable/worm";
import { Coordinate, MetersValue } from "../utils/coodinate";
import { GameState } from "../logic/gamestate";
import { TeamGroup } from "../logic/teams";

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
    }]);

    const bg = await world.addEntity(Background.create(game.viewport.screenWidth, game.viewport.screenHeight, game.viewport, [20, 21, 50, 35], terrain));
    await world.addEntity(terrain);
    bg.addToWorld(game.pixiApp.stage, parent);
    terrain.addToWorld(parent);

    const water = world.addEntity(
        new Water(
            MetersValue.fromPixels(worldWidth*4),
            MetersValue.fromPixels(worldHeight), 
        world)
    );    water.addToWorld(parent, world);
    const worm = world.addEntity(await Worm.create(parent, world, Coordinate.fromScreen(900,105), gameState.getTeamByIndex(0).worms[0], (worm, definition, duration) => {
        const newProjectile = definition.fireFn(parent, world, worm, duration);
        world.addEntity(newProjectile);
    }));

    game.viewport.follow(worm.sprite);

    game.viewport.on('clicked', async (evt) => {
        const position = Coordinate.fromScreen(evt.world.x, evt.world.y);
        const entity = await Grenade.create(parent, world, position, {x: 0.01, y: 0});
        //const entity = await BazookaShell.create(game, parent, composite, position, 1, 0.01, 6);
        world.addEntity(entity);
    });
    
}