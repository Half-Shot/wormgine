import { Application, Assets, Graphics, GraphicsGeometry, Rectangle, RoundedRectangle } from 'pixi.js';
import { manifest } from './assets/manifest';
import { Grenade } from './entities/grenade';
import Matter, { Bodies, Common, Composite, Engine } from "matter-js";

import * as polyDecomp from 'poly-decomp-es';

import "pathseg";

export class Game {
    private readonly pixiApp: Application;
    private readonly matterEngine: Engine;
    constructor() {
        // The application will create a renderer using WebGL, if possible,
        // with a fallback to a canvas render. It will also setup the ticker
        // and the root stage PIXI.Container
        this.pixiApp = new Application({ });
        this.matterEngine = Engine.create({
            gravity: {
                // x: 0.75,
                y: 0.75
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
    }

    public setupMatter() {
        const width = this.pixiApp.view.width;
        const height = this.pixiApp.view.height - 10;
        const wallBottom = Bodies.rectangle(
            width / 2,
            height,
            this.pixiApp.view.width,
            10,
            // this.pixiApp.stage.width / 2,
            // this.pixiApp.stage.height,
            // this.pixiApp.stage.width,
            // 10,
            {
              isStatic: true,
            }
        );
        const rect = new Rectangle(wallBottom.position.x - (width/2), wallBottom.position.y - 5, width, 50);
        const gfx = new Graphics();
        gfx.lineStyle(10, 0xFFBD01, 1);
        gfx.beginFill(0xC34288, 1);
        gfx.drawShape(rect);
        gfx.endFill();
        this.pixiApp.stage.addChild(gfx);
        Composite.add(this.matterEngine.world, [ wallBottom ]);
    }

    public async run() {
        console.log('Running');
        this.setupMatter();
        
        const entity = new Grenade({ x: 50, y: 50 }, { x: 0.001, y: 0 });
        await entity.create(this.pixiApp.stage, this.matterEngine.world);

        if (entity.update) {
            const tickerFn = (dt: number) => {
                entity.update(dt);
                if (entity.destroyed) {
                    this.pixiApp.ticker.remove(tickerFn)
                }
            };
            this.pixiApp.ticker.add(tickerFn, undefined, entity.priority)
        }

        Matter.Runner.run(this.matterEngine);
    }

    public get canvas() {
        return this.pixiApp.view as HTMLCanvasElement
    }

    public destroy() {
        this.pixiApp.destroy();
    }
}