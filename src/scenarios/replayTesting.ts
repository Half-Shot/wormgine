import { Assets, Ticker } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Worm, WormState } from "../entities/playable/worm";
import { Coordinate, MetersValue } from "../utils/coodinate";
import { GameState } from "../logic/gamestate";
import { GameStateOverlay } from "../overlays/gameStateOverlay";
import { GameDrawText, TeamWinnerText, templateRandomText } from "../text/toasts";
import { PhysicsEntity } from "../entities/phys/physicsEntity";
import { StateReplay } from "../state/player";
import { RemoteWorm } from "../entities/playable/remoteWorm";
import { EntityType } from "../entities/type";
import { getDefinitionForCode } from "../weapons";

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

    const player = new StateReplay(replayData);
    player.on('started', () => {
        console.log('started playback');
    });

    player.on('entitySync', (syncData) => {
        console.log('syncData', syncData);
    });


    const dataPromise = player.waitForFullGameState();
    player.play();

    const initialData = await dataPromise;


    const gameState = new GameState(initialData.gameState.teams, {
        // TODO: Rules.
        winWhenOneGroupRemains: true,
    });


    // TODO: Background
    const bg = await world.addEntity(Background.create(game.viewport.screenWidth, game.viewport.screenHeight, game.viewport, [20, 21, 50, 35], terrain));
    bg.addToWorld(game.pixiApp.stage, parent);
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

    const wormInstances = new Map<string, RemoteWorm>();

    player.on('wormAction', (wormAction) => {
        const wormInst = wormInstances.get(wormAction.id);
        if (!wormInst) {
            throw Error('Worm not found');
        }
        wormInst.replayWormAction(wormAction.action);
    });

    player.on('wormSelectWeapon', (wormWeapon) => {
        const wormInst = wormInstances.get(wormWeapon.id);
        if (!wormInst) {
            throw Error('Worm not found');
        }
        wormInst.selectWeapon(getDefinitionForCode(wormWeapon.weapon));
    });

    const worms = initialData.entitySync.filter(v => v.type === EntityType.Worm).reverse();
    let i = 300;
    for (const team of gameState.getActiveTeams()) {
        for (const wormInstance of team.worms) {
            const existingEntData = worms.pop()!;
            console.log('existing worm data', existingEntData);
            const wormEnt = world.addEntity(
                await RemoteWorm.create(parent, world, new Coordinate(
                    parseFloat(existingEntData.tra.x),
                    parseFloat(existingEntData.tra.y),
                ), wormInstance, async (worm, definition, opts) => {
                const newProjectile = definition.fireFn(parent, world, worm, opts);
                if (newProjectile instanceof PhysicsEntity) {
                    parent.follow(newProjectile.sprite);
                    world.addEntity(newProjectile);
                }
                const res = await newProjectile.onFireResult;
                if (newProjectile instanceof PhysicsEntity) { 
                    parent.follow(worm.sprite);
                }
                return res;
            }, overlay.toaster), existingEntData.uuid);
            wormInstances.set(wormInstance.uuid, wormEnt);
        }
    }

    let endOfRoundWaitDuration: number|null = null;
    let endOfGameFadeOut: number|null = null;
    let currentWorm: Worm|undefined;

    player.on('gameState', (dataUpdate) => {
        const nextState = gameState.applyGameStateUpdate(dataUpdate);
        console.log('advancing round', nextState);
        if ('winningTeams' in nextState) {
            if (nextState.winningTeams.length) {
                overlay.toaster.pushToast(templateRandomText(TeamWinnerText, {
                    TeamName: nextState.winningTeams.map(t => t.name).join(', '),
                }), 8000);
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
                game.goToMenu({ winningTeams: gameState.getActiveTeams() });
            }
            return;
        }
        if (currentWorm && currentWorm.currentState !== WormState.Inactive) {
            return;
        }
        if (endOfRoundWaitDuration === null) {
            return;
        }
        if (endOfRoundWaitDuration <= 0) {
            if (!currentWorm) {
                throw Error('Expected next worm');
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

const replayData = [
    {"index":0,"data":null,"kind":0,"ts":7031.164},
    {"index":1,"data":{"iteration":0,"wind":0,"teams":[{"name":"The Prawns","group":0,"worms":[{"uuid":"bced0520-2865-4dd4-ab87-d8881a4053b1","name":"Shrimp","health":100,"maxHealth":100}]},{"name":"The Whales","group":1,"worms":[{"uuid":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","name":"Welsh boy","health":100,"maxHealth":100}]}]},"kind":4,"ts":7037.41},
    {"index":2,"data":{"entities":[{"uuid":"d8c4cfa9-5031-4e64-9c4a-8761ad6030bd","type":0,"tra":{"x":"45","y":"5.25"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"bced0520-2865-4dd4-ab87-d8881a4053b1"},{"uuid":"ced26dc6-6a34-4620-ae9d-2eca87870839","type":0,"tra":{"x":"55","y":"5.25"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"8db4d2ed-dddb-4df4-99f2-92913fe0496d"}]},"kind":1,"ts":7037.764},
    {"index":3,"data":{"entities":[{"uuid":"d8c4cfa9-5031-4e64-9c4a-8761ad6030bd","type":0,"tra":{"x":"45","y":"5.3399248123168945"},"rot":"0","vel":{"x":"0","y":"1.3079999685287476"},"wormIdent":"bced0520-2865-4dd4-ab87-d8881a4053b1"},{"uuid":"ced26dc6-6a34-4620-ae9d-2eca87870839","type":0,"tra":{"x":"55","y":"5.3399248123168945"},"rot":"0","vel":{"x":"0","y":"1.3079999685287476"},"wormIdent":"8db4d2ed-dddb-4df4-99f2-92913fe0496d"}]},"kind":1,"ts":7042.458},
    {"index":4,"data":{"iteration":0,"wind":-4,"teams":[{"name":"The Prawns","group":0,"worms":[{"uuid":"bced0520-2865-4dd4-ab87-d8881a4053b1","name":"Shrimp","health":100,"maxHealth":100}]},{"name":"The Whales","group":1,"worms":[{"uuid":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","name":"Welsh boy","health":100,"maxHealth":100}]}]},"kind":4,"ts":7042.615},
    {"index":5,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":2},"kind":2,"ts":13435.53},
    {"index":6,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":4},"kind":2,"ts":13625.908},
    {"index":7,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":2},"kind":2,"ts":14088.931},
    {"index":8,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":4},"kind":2,"ts":14591.92},
    {"index":9,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":5},"kind":2,"ts":14895.055},
    {"index":10,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":6},"kind":2,"ts":15254.915},
    {"index":11,"data":{"entities":[{"uuid":"d8c4cfa9-5031-4e64-9c4a-8761ad6030bd","type":0,"tra":{"x":"45","y":"6.476071834564209"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"bced0520-2865-4dd4-ab87-d8881a4053b1"},{"uuid":"ced26dc6-6a34-4620-ae9d-2eca87870839","type":0,"tra":{"x":"55","y":"6.476071834564209"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"8db4d2ed-dddb-4df4-99f2-92913fe0496d"},{"uuid":"be0acc4f-7dd6-47a7-b080-7d2d73c8c56d","timer":1799.9999999999998,"owner":"bced0520-2865-4dd4-ab87-d8881a4053b1","timerSecs":30,"type":2,"tra":{"x":"46.64986801147461","y":"5.976071834564209"},"rot":"0","vel":{"x":"5.8605804443359375","y":"-4.022852897644043"}}]},"kind":1,"ts":15256.807},
    {"index":12,"data":{"entities":[]},"kind":1,"ts":15992.854},
    {"index":13,"data":{"iteration":1,"wind":-10,"teams":[{"name":"The Prawns","group":0,"worms":[{"uuid":"bced0520-2865-4dd4-ab87-d8881a4053b1","name":"Shrimp","health":100,"maxHealth":100}]},{"name":"The Whales","group":1,"worms":[{"uuid":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","name":"Welsh boy","health":100,"maxHealth":100}]}]},"kind":4,"ts":15993.12},
    {"index":14,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","weapon":0},"kind":3,"ts":21508.415},
    {"index":15,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":0},"kind":2,"ts":21696.045},
    {"index":16,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":4},"kind":2,"ts":21794.942},
    {"index":17,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":2},"kind":2,"ts":22008.725},
    {"index":18,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":4},"kind":2,"ts":22510.041},
    {"index":19,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":5},"kind":2,"ts":23195.073},
    {"index":20,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":6},"kind":2,"ts":23755.019},
    {"index":21,"data":{"entities":[{"uuid":"ced26dc6-6a34-4620-ae9d-2eca87870839","type":0,"tra":{"x":"54.82000732421875","y":"6.476066589355469"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"8db4d2ed-dddb-4df4-99f2-92913fe0496d"},{"uuid":"91f03f03-52f5-4f94-8163-8717b5e4035f","timer":180,"owner":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","timerSecs":3,"type":1,"tra":{"x":"51.40930938720703","y":"6.1760663986206055"},"rot":"0","vel":{"x":"-14.094715118408203","y":"-9.64271354675293"}}]},"kind":1,"ts":23756.05},
    {"index":22,"data":{"entities":[{"uuid":"91f03f03-52f5-4f94-8163-8717b5e4035f","timer":0,"owner":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","timerSecs":3,"type":1,"tra":{"x":"-5.673912048339844","y":"47.708160400390625"},"rot":"0.15000000596046448","vel":{"x":"-14.094715118408203","y":"30.087696075439453"}}]},"kind":1,"ts":26460.429},
    {"index":23,"data":{"iteration":2,"wind":-7,"teams":[{"name":"The Prawns","group":0,"worms":[{"uuid":"bced0520-2865-4dd4-ab87-d8881a4053b1","name":"Shrimp","health":100,"maxHealth":100}]},{"name":"The Whales","group":1,"worms":[{"uuid":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","name":"Welsh boy","health":100,"maxHealth":100}]}]},"kind":4,"ts":26460.861},
    {"index":24,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","weapon":2},"kind":3,"ts":31092.087},
    {"index":25,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":2},"kind":2,"ts":31536.176},
    {"index":26,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":4},"kind":2,"ts":31801.329},
    {"index":27,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":3},"kind":2,"ts":32113.183},
    {"index":28,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":4},"kind":2,"ts":32923.263},
    {"index":29,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":3},"kind":2,"ts":33055.188},
    {"index":30,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":4},"kind":2,"ts":33168.192},
    {"index":31,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":3},"kind":2,"ts":33348.256},
    {"index":32,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":4},"kind":2,"ts":33387.194},
    {"index":33,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":5},"kind":2,"ts":33596.288},
    {"index":34,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":6},"kind":2,"ts":33601.909},
    {"index":35,"data":{"entities":[{"uuid":"ced26dc6-6a34-4620-ae9d-2eca87870839","type":0,"tra":{"x":"54.82000732421875","y":"6.476066589355469"},"rot":"0","vel":{"x":"0.7876647710800171","y":"-0.6378039717674255"},"wormIdent":"8db4d2ed-dddb-4df4-99f2-92913fe0496d"}]},"kind":1,"ts":33657.854},
    {"index":36,"data":{"entities":[{"uuid":"ced26dc6-6a34-4620-ae9d-2eca87870839","type":0,"tra":{"x":"54.87249755859375","y":"6.4567084312438965"},"rot":"0","vel":{"x":"0.7876647710800171","y":"0.016196206212043762"},"wormIdent":"8db4d2ed-dddb-4df4-99f2-92913fe0496d"}]},"kind":1,"ts":33661.932},
    {"index":37,"data":{"iteration":4,"wind":-8,"teams":[{"name":"The Prawns","group":0,"worms":[{"uuid":"bced0520-2865-4dd4-ab87-d8881a4053b1","name":"Shrimp","health":100,"maxHealth":100}]},{"name":"The Whales","group":1,"worms":[{"uuid":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","name":"Welsh boy","health":75,"maxHealth":100}]}]},"kind":4,"ts":33662.438},
    {"index":38,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","weapon":1},"kind":3,"ts":37055.598},
    {"index":39,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":1},"kind":2,"ts":39157.862},
    {"index":40,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":4},"kind":2,"ts":39311.46},
    {"index":41,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":0},"kind":2,"ts":39716.464},
    {"index":42,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":4},"kind":2,"ts":39817.205},
    {"index":43,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":3},"kind":2,"ts":40175.229},
    {"index":44,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":4},"kind":2,"ts":40292.096},
    {"index":45,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":5},"kind":2,"ts":40471.27},
    {"index":46,"data":{"id":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","action":6},"kind":2,"ts":40943.155},
    {"index":47,"data":{"entities":[{"uuid":"ced26dc6-6a34-4620-ae9d-2eca87870839","type":0,"tra":{"x":"55.033329010009766","y":"6.476850986480713"},"rot":"0","vel":{"x":"0","y":"0"},"wormIdent":"8db4d2ed-dddb-4df4-99f2-92913fe0496d"},{"uuid":"9d1b1bf3-1d41-48ae-9cc2-18abf04c4836","timer":1799.9999999999998,"owner":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","timerSecs":30,"type":2,"tra":{"x":"52.173072814941406","y":"5.976850986480713"},"rot":"0","vel":{"x":"-13.695172309875488","y":"-4.523504257202148"}}]},"kind":1,"ts":40944.256},
    {"index":48,"data":{"entities":[]},"kind":1,"ts":41747.767},
    {"index":49,"data":{"iteration":5,"wind":6,"teams":[{"name":"The Prawns","group":0,"worms":[{"uuid":"bced0520-2865-4dd4-ab87-d8881a4053b1","name":"Shrimp","health":100,"maxHealth":100}]},{"name":"The Whales","group":1,"worms":[{"uuid":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","name":"Welsh boy","health":75,"maxHealth":100}]}]},"kind":4,"ts":41748.164},
    {"index":50,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":3},"kind":2,"ts":46846.209},
    {"index":51,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":4},"kind":2,"ts":46985.895},
    {"index":52,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":2},"kind":2,"ts":47199.381},
    {"index":53,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":4},"kind":2,"ts":48383.573},
    {"index":54,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":3},"kind":2,"ts":48858.236},
    {"index":55,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":4},"kind":2,"ts":48992.196},
    {"index":56,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","weapon":0},"kind":3,"ts":49258.228},
    {"index":57,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","weapon":2},"kind":3,"ts":49698.226},
    {"index":58,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":5},"kind":2,"ts":50248.778},
    {"index":59,"data":{"id":"bced0520-2865-4dd4-ab87-d8881a4053b1","action":6},"kind":2,"ts":50265.082},
    {"index":60,"data":{"entities":[]},"kind":1,"ts":50265.477},
    {"index":61,"data":{"entities":[]},"kind":1,"ts":50279.861},
    {"index":62,"data":{"iteration":6,"wind":8,"teams":[{"name":"The Prawns","group":0,"worms":[{"uuid":"bced0520-2865-4dd4-ab87-d8881a4053b1","name":"Shrimp","health":100,"maxHealth":100}]},{"name":"The Whales","group":1,"worms":[{"uuid":"8db4d2ed-dddb-4df4-99f2-92913fe0496d","name":"Welsh boy","health":75,"maxHealth":100}]}]},"kind":4,"ts":50280.08},
].map(s => JSON.stringify(s));