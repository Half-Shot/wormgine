import "pathseg";
import { Application, Assets, UPDATE_PRIORITY, Text, Ticker } from 'pixi.js';
import { BazookaShell } from './entities/phys/bazookaShell';
import { Explosion } from './entities/explosion';
import { Grenade } from './entities/phys/grenade';
import { IGameEntity, IMatterEntity } from './entities/entity';
import { manifest } from './assets/manifest';
import { QuadtreeDetector } from './quadtreeDetector';
import { Worm } from './entities/phys/worm';
import * as polyDecomp from 'poly-decomp-es';
import Matter, { Common, Engine, Events, Body } from "matter-js";
import grenadeIsland from './scenarios/grenadeIsland';
import { Viewport } from 'pixi-viewport';

Common.setDecomp(polyDecomp);

const worldWidth = 1920;
const worldHeight = 1080;

export class Game {
    public readonly viewport: Viewport;
    public readonly matterEngine: Engine; 
    private readonly entities: IGameEntity[] = [];
    private readonly overlay = new Text('', {
        fontFamily: 'Arial',
        fontSize: 20,
        fill: 0xFFFFFF,
        align: 'center',
    });
    private readonly quadtreeDetector: QuadtreeDetector;

    public get pixiRoot() {
        return this.viewport;
    }

    public static async create(screenWidth: number, screenHeight: number): Promise<Game> {
        const pixiApp = new Application();
        await pixiApp.init({ width: screenWidth, height: screenHeight, preference: 'webgl', });
        return new Game(pixiApp);
    }

    constructor(public readonly pixiApp: Application) {
        // The application will create a renderer using WebGL, if possible,
        // with a fallback to a canvas render. It will also setup the ticker
        // and the root stage PIXI.Container
        // TODO: Set a sensible static width/height and have the canvas pan it.
        this.quadtreeDetector = new QuadtreeDetector(worldWidth, worldHeight);
        this.matterEngine = Engine.create({
            gravity: {
                x: 0,
                y: 0.5,
            },
            enableSleeping: true,
            timing: {
                timeScale: 1,
                timestamp: 0,
                lastElapsed: 0,
                lastDelta: 0,
            },
            detector: this.quadtreeDetector,
        });
        this.viewport = new Viewport({
            screenHeight: this.pixiApp.screen.height,
            screenWidth: this.pixiApp.screen.width,
            worldWidth: worldWidth,
            worldHeight: worldHeight,
            events: this.pixiApp.renderer.events // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
        });
        this.pixiApp.ticker.maxFPS = 90;
        this.pixiApp.stage.addChild(this.viewport);
        this.viewport
            .clamp({
                // top: -screenHeight*3,
                // bottom: screenHeight*2,
                // left: -screenWidth*2,
                // right: screenWidth*3,
                top: -3000,
                bottom: 2000,
                left: -2000,
                right: 3000,
                direction: 'y',
            })
            .decelerate()
            .drag()
        this.viewport.zoom(5);
    
        //this.viewport.fit()
        //this.viewport.moveCenter(worldWidth / 2, worldHeight / 2)   
    }

    public async loadResources() {
        await Assets.init({ manifest });

        // TODO: This is NOT the way I want to handle assets but it will do for now.
        const b = await Promise.all(manifest.bundles.map(bundle => 
            Assets.loadBundle(bundle.name)
        ));
        Grenade.texture = b[0].grenade;
        Grenade.bounceSound = b[1].bounce;
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
        const tickerFn = (dt: Ticker) => {
            entity.update?.(dt.deltaTime);
            if (entity.destroyed) {
                this.pixiApp.ticker.remove(tickerFn);
                this.entities.splice(this.entities.indexOf(entity), 1);
            }
        };
        this.pixiApp.ticker.add(tickerFn, undefined, entity.priority ? entity.priority : UPDATE_PRIORITY.LOW);
        return entity;
    }

    public findEntityByBodies(...bodies: Body[]) {
        const result: IMatterEntity[] = new Array(bodies.length);
        // TODO: o(n^2) function
        // TODO: Loose typing
        for (const entity of this.entities.filter(e => 'entityOwnsBody' in e) as IMatterEntity[]) {
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
        Events.on(this.matterEngine, 'collisionStart', (event) => {
            const [pairA] = event.pairs;
            const [entA, entB] = this.findEntityByBodies(pairA.bodyA, pairA.bodyB.parent);

            if (!entA || !entB) {
                console.warn(`Untracked collision between ${pairA.bodyA.id} (${entA}) and ${pairA.bodyB.id} (${entB})`);
                return;
            }

            const contact = pairA.contacts[0];

            entA.onCollision?.(entB, contact.vertex);
            entB.onCollision?.(entA, contact.vertex);
        });

        // Load this scenario
        grenadeIsland(this);

        this.overlay.position.x = 50;
        this.overlay.position.y = 10;

        const fpsSamples: number[] = [];


        this.pixiApp.ticker.add((dt) => {
            fpsSamples.splice(0, 0, dt.FPS);
            if (fpsSamples.length > dt.maxFPS) {
                fpsSamples.pop();
            }
            const avgFps = Math.round(fpsSamples.reduce((a,b) => a + b, 0) / fpsSamples.length);
            this.overlay.text = `FPS: ${avgFps} | Total bodies: ${this.matterEngine.world.bodies.length} | ` +
            `Active bodies: ${this.quadtreeDetector.activeBodies}`;
        }, undefined, UPDATE_PRIORITY.LOW);

        this.pixiApp.stage.addChild(this.overlay);

        // Matter.Runner.run(this.matterEngine);
        this.pixiApp.ticker.add(() => {
            Matter.Engine.update(this.matterEngine);
        }, undefined, UPDATE_PRIORITY.HIGH);
    }

    public get canvas() {
        return this.pixiApp.view as HTMLCanvasElement
    }

    public destroy() {
        this.pixiApp.destroy();
    }
}