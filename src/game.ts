import { Application, Assets } from 'pixi.js';
import { manifest } from './assets/manifest';
import { Grenade } from './entities/grenade';
import Matter, { Common, Engine, Events } from "matter-js";

import * as polyDecomp from 'poly-decomp-es';

import "pathseg";
import { IGameEntity, IMatterEntity } from './entities/entity';
import { Terrain } from './entities/terrain';
import { BazookaShell } from './entities/bazookaShell';
import { BitmapTerrain } from './entities/bitmapTerrain';

export class Game {
    private readonly pixiApp: Application;
    private readonly matterEngine: Engine;
    private readonly matterBodiesToEntity = new Map<number, IMatterEntity>();

    constructor() {
        // The application will create a renderer using WebGL, if possible,
        // with a fallback to a canvas render. It will also setup the ticker
        // and the root stage PIXI.Container
        this.pixiApp = new Application({ width: 1280, height: 720 });
        this.matterEngine = Engine.create({
            gravity: {
                x: 0.75,
                y: 0.5,
            }
            // gravity: {
            //     scale: 1,
            // }
        });
        Common.setDecomp(polyDecomp);
    }

    public async loadResources() {
        await Assets.init({ manifest });

        const b = await Promise.all(manifest.bundles.map(bundle => 
            Assets.loadBundle(bundle.name)
        ));
        Grenade.texture = b[0].grenade;
        BazookaShell.texture = b[0].grenade;
        BitmapTerrain.texture = b[0].island1;
    }

    public async addEntity(entity: IGameEntity) {
        await entity.create(this.pixiApp.stage, this.matterEngine.world);
        let entLabels: number[] = [];
        if ('bodies' in entity) {
            const matEnt = entity as IMatterEntity;
            for (const body of matEnt.bodies) { 
                this.matterBodiesToEntity.set(body.id, matEnt);
                entLabels.push(body.id);
            }
            console.log("Logged ", entLabels, "for", matEnt);
        }

        if (entity.update) {
            const tickerFn = (dt: number) => {
                entity.update!(dt);
                if (entity.destroyed) {
                    this.pixiApp.ticker.remove(tickerFn);
                    entLabels.forEach(l => this.matterBodiesToEntity.delete(l));
                }
            };
            this.pixiApp.ticker.add(tickerFn, undefined, entity.priority)
        }
    }

    public async run() {
        console.log('Running');
        this.addEntity(new BitmapTerrain(this.pixiApp.view.width, this.pixiApp.view.height, this.matterEngine.world));
        let angle = 0;
        this.canvas.addEventListener('click', (evt: MouseEvent) => {
            angle += 0.25;
            console.log('Click', angle);
            const rect = (evt.target as HTMLCanvasElement).getBoundingClientRect();
            const entity = new BazookaShell({ x: evt.x - rect.left, y: evt.y - rect.top }, angle, 0.001, 0.03);
            this.addEntity(entity);
        });

        // an example of using collisionStart event on an engine
        Events.on(this.matterEngine, 'collisionStart', (event) => {
            const [pairA] = event.pairs;
            console.log('collisionStart', pairA);
            console.log(this.matterBodiesToEntity);
            const entA = this.matterBodiesToEntity.get(pairA.bodyA.id) ?? this.matterBodiesToEntity.get(pairA.bodyA.parent.id);
            const entB = this.matterBodiesToEntity.get(pairA.bodyB.id) ?? this.matterBodiesToEntity.get(pairA.bodyB.parent.id);

            

            if (!entA || !entB) {
                console.warn(`Untracked collision between ${pairA.bodyA.id} (${entA}) and ${pairA.bodyB.id} (${entB})`);
                return;
            }

            const contact = pairA.activeContacts[0];

            entA.onCollision?.(entB, contact);
            entB.onCollision?.(entA, contact);
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