import "pathseg";
import { Application, Assets, UPDATE_PRIORITY, Text } from 'pixi.js';
import { Background } from './entities/background';
import { BazookaShell } from './entities/phys/bazookaShell';
import { BitmapTerrain } from './entities/bitmapTerrain';
import { Explosion } from './entities/explosion';
import { Grenade } from './entities/phys/grenade';
import { IGameEntity, IMatterEntity } from './entities/entity';
import { manifest } from './assets/manifest';
import { QuadtreeDetector } from './quadtreeDetector';
import { Water } from './entities/water';
import { Worm } from './entities/phys/worm';
import * as polyDecomp from 'poly-decomp-es';
import Matter, { Common, Engine, Events, Body, Bodies, Query } from "matter-js";

Common.setDecomp(polyDecomp);

export class Game {
    private readonly pixiApp: Application;
    private readonly matterEngine: Engine; 
    private readonly entities: IGameEntity[] = [];
    private readonly overlay = new Text('', {
        fontFamily: 'Arial',
        fontSize: 20,
        fill: 0xFFFFFF,
        align: 'center',
    });
    private readonly quadtreeDetector: QuadtreeDetector;

    constructor(width: number, height: number) {
        // The application will create a renderer using WebGL, if possible,
        // with a fallback to a canvas render. It will also setup the ticker
        // and the root stage PIXI.Container
        this.quadtreeDetector = new QuadtreeDetector(width, height);
        this.pixiApp = new Application({ width, height });
        this.matterEngine = Engine.create({
            gravity: {
                x: 0.0,
                y: 0.2,
            },
            enableSleeping: true,
            // detector: this.quadtreeDetector,
        });
    }

    public async loadResources() {
        await Assets.init({ manifest });

        const b = await Promise.all(manifest.bundles.map(bundle => 
            Assets.loadBundle(bundle.name)
        ));
        Grenade.texture = b[0].grenade;
        Grenade.bounceSound = b[1].bounce;
        console.log(b);
        BazookaShell.texture = b[0].bazooka_shell;
        Worm.texture = b[0].grenade;
        Explosion.explosionSounds = 
            [
                b[1].explosion1,
                b[1].explosion2,
                b[1].explosion3
            ];
    }

    public addEntity<T extends IGameEntity>(entity: T): T {
        this.entities.push(entity);
        const tickerFn = (dt: number) => {
            entity.update?.(dt);
            if (entity.destroyed) {
                this.pixiApp.ticker.remove(tickerFn);
                this.entities.splice(this.entities.indexOf(entity), 1);
            }
        };
        this.pixiApp.ticker.add(tickerFn, undefined, entity.priority ? entity.priority : UPDATE_PRIORITY.LOW);
        return entity;
    }

    private findEntityByBodies(...bodies: Body[]) {
        const result: IMatterEntity[] = new Array(bodies.length);
        for (const entity of this.entities.filter(e => 'entityOwnsBody' in e) as IMatterEntity[]) {
            // TODO: Skip 0 if we have a slot for zero already
            for (let bIdx = 0; bIdx < bodies.length; bIdx++) {
                const body = bodies[bIdx];
                if (entity?.entityOwnsBody(body.id)) {
                    result[bIdx] = entity as IMatterEntity;
                }
            }
        }
        return result;
    }

    public async run() {
        const parent = this.pixiApp.stage;
        const composite = this.matterEngine.world;
        const { width, height } = this.pixiApp.view;
        const terrain = BitmapTerrain.create(this.pixiApp.view.width, this.pixiApp.view.height, this.matterEngine.world, Assets.get('island1'));
        const bg = await this.addEntity(Background.create(width, height, [20, 21, 50, 35], terrain));
        await this.addEntity(terrain);
        bg.addToWorld(parent);
        terrain.addToWorld(parent);
        console.log(terrain);

        const water = await this.addEntity(new Water(width,height));
        water.create(parent, composite);
        this.addEntity(await Worm.create(parent, composite, {x: 900, y: 400} , terrain));

        this.overlay.position.x = 50;
        this.overlay.position.y = 10;

        this.pixiApp.ticker.add(() => {
            this.overlay.text = `Total bodies: ${this.matterEngine.world.bodies.length} | ` +
            `Active bodies: ${this.quadtreeDetector.activeBodies}`;
        }, undefined, UPDATE_PRIORITY.LOW);

        this.pixiApp.stage.addChild(this.overlay);

        Events.on(this.matterEngine, 'collisionStart', (event) => {
            console.log('Collision!');
            const [pairA] = event.pairs;
            const [entA, entB] = this.findEntityByBodies(pairA.bodyA, pairA.bodyB.parent);

            if (!entA || !entB) {
                console.warn(`Untracked collision between ${pairA.bodyA.id} (${entA}) and ${pairA.bodyB.id} (${entB})`);
                return;
            }

            const contact = pairA.activeContacts[0];

            entA.onCollision?.(entB, contact.vertex);
            entB.onCollision?.(entA, contact.vertex);
        });

        this.canvas.addEventListener('click', async (evt: MouseEvent) => {
            const rect = (evt.target as HTMLCanvasElement).getBoundingClientRect();
            const position = { x: evt.x - rect.left, y: evt.y - rect.top };
            const entity = await Grenade.create(parent, composite, position, {x: 0.005, y: -0.01});
            //const entity = await BazookaShell.create(parent, composite, position, 0, 0, 0 /*{x: 0.005, y: -0.01}*/);
            entity.explodeHandler = (point, radius) => {
                // Detect if anything is around us.
                const circ = Bodies.circle(point.x, point.y, radius);
                const hit = Query.collides(circ, this.matterEngine.world.bodies).sort((a,b) => b.depth - a.depth);
                this.addEntity(Explosion.create(parent, point, radius));
                // Find contact point with any terrain
                for (const hitBody of hit) {
                    const [ent] = (this.findEntityByBodies(hitBody.bodyA, hitBody.bodyB)).filter(e => e !== entity);
                    // TODO: Cheating massively
                    entity.onCollision(ent, hitBody.bodyA.position);
                }
            }
            this.addEntity(entity);
        });

        Matter.Runner.run(this.matterEngine);
    }

    public get canvas() {
        return this.pixiApp.view as HTMLCanvasElement
    }

    public destroy() {
        this.pixiApp.destroy();
    }
}