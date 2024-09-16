import { Assets } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Worm } from "../entities/phys/worm";
import { Grenade } from "../entities/phys/grenade";

export default async function runScenario(game: Game) {
    const parent = game.viewport;
    const composite = game.matterEngine.world;
    const { worldWidth, worldHeight } = game.viewport;

    const terrain = BitmapTerrain.create(
        worldWidth,
        worldHeight,
        game.matterEngine.world,
        Assets.get('island1')
    );

    const bg = await game.addEntity(Background.create(game.viewport.screenWidth, game.viewport.screenHeight, game.viewport, [20, 21, 50, 35], terrain));
    await game.addEntity(terrain);
    bg.addToWorld(game.pixiApp.stage, parent);
    terrain.addToWorld(parent);

    const water = await game.addEntity(new Water(worldWidth,worldHeight));
    water.create(parent, composite);
    const worm = game.addEntity(await Worm.create(parent, composite, {x: 900, y: 400} , terrain, async (worm, definition, duration) => {
        const newProjectile = await definition.fireFn(game, parent, composite, worm, duration);
        game.addEntity(newProjectile);
    }));

    game.viewport.follow(worm.sprite);

    game.viewport.on('clicked', async (evt) => {
        const position = { x: evt.world.x, y: evt.world.y };
        const entity = await Grenade.create(game, parent, composite, position, {x: 0.01, y: 0});
        //const entity = await BazookaShell.create(parent, composite, position, 0, 0, 0 /*{x: 0.005, y: -0.01}*/);
        game.addEntity(entity);
    });
    
}