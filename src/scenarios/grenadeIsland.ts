import { Assets } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Worm } from "../entities/phys/worm";
import { Grenade } from "../entities/phys/grenade";
import { Coordinate, MetersValue } from "../utils/coodinate";
import { TestDummy } from "../entities/phys/testDummy";
// import { BazookaShell } from "../entities/phys/bazookaShell";

export default async function runScenario(game: Game) {
    const parent = game.viewport;
    const world = game.world;
    const { worldWidth, worldHeight } = game.viewport;

    const terrain = BitmapTerrain.create(
        worldWidth,
        worldHeight,
        game.world,
        Assets.get('terrain2')
    );

    const bg = await world.addEntity(Background.create(game.viewport.screenWidth, game.viewport.screenHeight, game.viewport, [20, 21, 50, 35], terrain));
    await world.addEntity(terrain);
    bg.addToWorld(game.pixiApp.stage, parent);
    terrain.addToWorld(parent);

    const water = world.addEntity(
        new Water(
            MetersValue.fromPixels(worldWidth*4),
            MetersValue.fromPixels(worldHeight), 
        world)
    );
    water.addToWorld(game.viewport, world);
    // const worm = world.addEntity(await Worm.create(parent, world, Coordinate.fromScreen(500,400), async (worm, definition, duration) => {
    //     const newProjectile = await definition.fireFn(parent, world, worm, duration);
    //     world.addEntity(newProjectile);
    // }));

    const dummy = world.addEntity(TestDummy.create(parent, world, Coordinate.fromScreen(650,620)));
    game.viewport.follow(dummy.sprite);

    game.viewport.on('clicked', async (evt) => {
        const position = { x: evt.world.x, y: evt.world.y };
        const entity = await Grenade.create(parent, world, position, {x: 0.01, y: 0});
        //const entity = await BazookaShell.create(game, parent, composite, position, 1, 0.01, 6);
        world.addEntity(entity);
    });
    
}