import { Assets } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Worm } from "../entities/phys/worm";
import { Grenade } from "../entities/phys/grenade";
import { BazookaShell } from "../entities/phys/bazookaShell";

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

    const water = await world.addEntity(new Water(worldWidth,worldHeight, world));
    water.create(parent, world);
    const worm = world.addEntity(await Worm.create(parent, world, {x: 900, y: 400} , terrain, async (worm, definition, duration) => {
        const newProjectile = await definition.fireFn(game, parent, world, worm, duration);
        world.addEntity(newProjectile);
    }));

    game.viewport.follow(worm.sprite);

    game.viewport.on('clicked', async (evt) => {
        const position = { x: evt.world.x, y: evt.world.y };
        const entity = await Grenade.create(parent, world, position, {x: 0.01, y: 0});
        //const entity = await BazookaShell.create(game, parent, composite, position, 1, 0.01, 6);
        world.addEntity(entity);
    });
    
}