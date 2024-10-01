import { Assets } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Grenade } from "../entities/phys/grenade";
import { EndTurnReason, Worm, WormState } from "../entities/playable/worm";
import { Coordinate, MetersValue } from "../utils/coodinate";
import { GameState } from "../logic/gamestate";
import { TeamGroup, teamGroupToColorSet } from "../logic/teams";
import { GameStateOverlay } from "../overlays/gameStateOverlay";
import { templateRandomText, TurnEndTextFall, TurnEndTextMiss, TurnEndTextOther, TurnStartText } from "../text/toasts";

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
    const worm = world.addEntity(await Worm.create(parent, world, Coordinate.fromScreen(900,105), gameState.getTeamByIndex(0).worms[0], (worm, definition, opts) => {
        const newProjectile = definition.fireFn(parent, world, worm, opts);
        world.addEntity(newProjectile);
    }));


    const overlay = new GameStateOverlay(game.pixiApp.ticker, game.pixiApp.stage, gameState, world, game.viewport.screenWidth, game.viewport.screenHeight);

    game.viewport.follow(worm.sprite);

    game.viewport.on('clicked', async (evt) => {
        const position = Coordinate.fromScreen(evt.world.x, evt.world.y);
        const entity = await Grenade.create(parent, world, position, {x: 0.01, y: 0});
        //const entity = await BazookaShell.create(game, parent, composite, position, 1, 0.01, 6);
        world.addEntity(entity);
    });

    let endOfRoundWaitDuration: number|null = 0;

    game.pixiApp.ticker.add((dt) => {
        if (worm.currentState !== WormState.Inactive) {
            return;
        }
        if (endOfRoundWaitDuration === null) {
            let reasonSet: string[] = TurnEndTextOther;
            if (worm.endTurnReason === EndTurnReason.FallDamage) {
                reasonSet = TurnEndTextFall;
            } else if (worm.endTurnReason === EndTurnReason.FiredWeaponNoHit) {
                reasonSet = TurnEndTextMiss;
            }
            overlay.addNewToast(templateRandomText(reasonSet, {
                WormName: worm.wormIdent.name,
                TeamName: worm.wormIdent.team.name,
            })  , 2000);
            // Turn just ended.
            endOfRoundWaitDuration = 3000;
            return;
        }
        if (endOfRoundWaitDuration <= 0) {
            const nextState = gameState.advanceRound();
            if ('winningTeams' in nextState) {
                console.log('Winner was', nextState);
            } else {
                worm.onWormSelected();
                overlay.addNewToast(templateRandomText(TurnStartText, {
                    WormName: nextState.nextWorm.name,
                    TeamName: nextState.nextTeam.name,
                }), 3000, teamGroupToColorSet(nextState.nextTeam.group).fg);
            }
            endOfRoundWaitDuration = null;
            return;
        }
        endOfRoundWaitDuration -= dt.deltaMS;
    });
}