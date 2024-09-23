import { Assets, Text} from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Mine } from "../entities/phys/mine"
import { Grenade } from "../entities/phys/grenade";
import { Coordinate, MetersValue } from "../utils/coodinate";
import { TestDummy } from "../entities/phys/testDummy";
import staticController, { InputKind } from "../input";
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

    world.addEntity(Mine.create(parent, world, Coordinate.fromScreen(900,200)));

    let selectedWeapon: "grenade"|"mine" = "grenade"; 
    const timerText = new Text({
        text: `Selected Weapon (press S to switch): ${selectedWeapon}`,
        style: {
            fontFamily: 'Arial',
            fontSize: 20,
            fill: 0xFFFFFF,
            align: 'left',
        }
    });
    
    staticController.on('inputEnd', (kind: InputKind) => {
        if (kind !== InputKind.DebugSwitchWeapon) {
            return;
        }
        console.log('Weapon switch');
        selectedWeapon = selectedWeapon === "grenade" ? "mine" : "grenade";
        timerText.text = `Selected Weapon (press S to switch): ${selectedWeapon}`;
    });



    game.pixiApp.stage.addChild(timerText);

    game.viewport.on('clicked', async (evt) => {
        const position = Coordinate.fromScreen(evt.world.x, evt.world.y);
        let entity;
        if (selectedWeapon === "grenade") {
            entity = Grenade.create(parent, world, position, {x: 0, y:0});
        } else {
            entity = Mine.create(parent, world, position)
        }
        world.addEntity(entity);
    });
    
}