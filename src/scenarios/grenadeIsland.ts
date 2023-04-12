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
    const parent = game.pixiApp.stage;
    const composite = game.matterEngine.world;
    const { width, height } = game.pixiApp.view;

    const terrain = BitmapTerrain.create(
        game.pixiApp.view.width,
        game.pixiApp.view.height,
        game.matterEngine.world,
        Assets.get('island1')
    );
    const bg = await game.addEntity(Background.create(width, height, [20, 21, 50, 35], terrain));
    await game.addEntity(terrain);
    bg.addToWorld(parent);
    terrain.addToWorld(parent);
    console.log(terrain);

    const water = await game.addEntity(new Water(width,height));
    water.create(parent, composite);
    game.addEntity(await Worm.create(parent, composite, {x: 900, y: 400} , terrain, async (worm, definition, duration) => {
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

    game.canvas.addEventListener('click', async (evt: MouseEvent) => {
        const rect = (evt.target as HTMLCanvasElement).getBoundingClientRect();
        const position = { x: evt.x - rect.left, y: evt.y - rect.top };
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