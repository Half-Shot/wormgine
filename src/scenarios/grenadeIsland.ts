import { Assets } from "pixi.js";
import { Background } from "../entities/background";
import { BitmapTerrain } from "../entities/bitmapTerrain";
import type { Game } from "../game";
import { Water } from "../entities/water";
import { Worm } from "../entities/phys/worm";
import { Grenade } from "../entities/phys/grenade";
import { Bodies, Query } from "matter-js";
import { Explosion } from "../entities/explosion";
import { TimedExplosive } from "../entities/phys/timedExplosive";

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
    // TODO: Eventually pan this width but for now match the screen
    const bg = await game.addEntity(Background.create(game.viewport.screenWidth*2, game.viewport.screenHeight*1.5, [20, 21, 50, 35], terrain));
    await game.addEntity(terrain);
    bg.addToWorld(parent);
    terrain.addToWorld(parent);
    console.log(terrain);

    const water = await game.addEntity(new Water(worldWidth,worldHeight));
    water.create(parent, composite);
    const worm = game.addEntity(await Worm.create(parent, composite, {x: 900, y: 400} , terrain, async (worm, definition, duration) => {
        const newProjectile = await definition.fireFn(parent, composite, worm, duration);
        if (newProjectile instanceof TimedExplosive) {
            newProjectile.explodeHandler = (point, radius) => {
                // Detect if anything is around us.
                const circ = Bodies.circle(point.x, point.y, radius);
                const hit = Query.collides(circ, game.matterEngine.world.bodies).sort((a,b) => b.depth - a.depth);
                game.addEntity(Explosion.create(parent, point, radius));
                // Find contact point with any terrain
                for (const hitBody of hit) {
                    const [ent] = (game.findEntityByBodies(hitBody.bodyA, hitBody.bodyB)).filter(e => e !== newProjectile);
                    // TODO: Cheating massively
                    newProjectile.onCollision(ent, hitBody.bodyA.position);
                }
            }
        }

        game.addEntity(newProjectile);
    }));

    game.viewport.follow(worm.sprite);``

    game.viewport.on('clicked', async (evt) => {
        const position = { x: evt.world.x, y: evt.world.y };
        const entity = await Grenade.create(parent, composite, position, {x: 0.005, y: -0.01});
        //const entity = await BazookaShell.create(parent, composite, position, 0, 0, 0 /*{x: 0.005, y: -0.01}*/);
        entity.explodeHandler = (point, radius) => {
            // Detect if anything is around us.
            const circ = Bodies.circle(point.x, point.y, radius);
            const hit = Query.collides(circ, game.matterEngine.world.bodies).sort((a,b) => b.depth - a.depth);
            game.addEntity(Explosion.create(parent, point, radius));
            // Find contact point with any terrain
            for (const hitBody of hit) {
                const [ent] = (game.findEntityByBodies(hitBody.bodyA, hitBody.bodyB)).filter(e => e !== entity);
                // TODO: Cheating massively
                entity.onCollision(ent, hitBody.bodyA.position);
            }
        }
        game.addEntity(entity);
    });
    
}