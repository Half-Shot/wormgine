import { Application, Graphics, UPDATE_PRIORITY } from 'pixi.js';
import grenadeIsland from './scenarios/grenadeIsland';
import borealisTribute from './scenarios/borealisTribute';
import testingGround from './scenarios/testingGround';
import boneIsles from './scenarios/boneIsles';
import { Viewport } from 'pixi-viewport';
import { getAssets } from "./assets";
import { GameDebugOverlay } from "./overlays/debugOverlay";
import { GameWorld } from "./world";
import RAPIER from "@dimforge/rapier2d-compat";
import { readAssetsForEntities } from "./entities";

const worldWidth = 1920;
const worldHeight = 1080;


export class Game {
    public readonly viewport: Viewport;
    private readonly rapierWorld: RAPIER.World; 
    public readonly world: GameWorld;
    public readonly rapierGfx: Graphics;

    public get pixiRoot() {
        return this.viewport;
    }

    public static async create(window: Window, level: string): Promise<Game> {
        await RAPIER.init();
        const pixiApp = new Application();
        await pixiApp.init({ resizeTo: window, preference: 'webgl' });
        return new Game(pixiApp, level);
    }

    constructor(public readonly pixiApp: Application, public readonly level: string) {
        // TODO: Set a sensible static width/height and have the canvas pan it.
        this.rapierWorld = new RAPIER.World({ x: 0, y: 9.81 });
        this.rapierGfx = new Graphics();
        this.viewport = new Viewport({
            screenHeight: this.pixiApp.screen.height,
            screenWidth: this.pixiApp.screen.width,
            worldWidth: worldWidth,
            worldHeight: worldHeight,
            // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
            events: this.pixiApp.renderer.events
        });
        this.world = new GameWorld(this.rapierWorld, this.pixiApp.ticker, this.viewport);
        this.pixiApp.ticker.maxFPS = 90;
        this.pixiApp.stage.addChild(this.viewport);
        this.viewport
            .clamp({
                top: -3000,
                bottom: 2000,
                left: -2000,
                right: 3000,
                direction: 'y',
            })
            .decelerate()
            .drag()
        this.viewport.zoom(8);
    }

    public async loadResources() {
        const { textures, sounds } = getAssets();
        readAssetsForEntities({textures, sounds});
    }

    public async run() {
        // Load this scenario
        if (this.level === "grenadeIsland") {
            grenadeIsland(this);
        } else if (this.level === "borealisTribute") {
            borealisTribute(this);
        } else if (this.level === "testingGround") {
            testingGround(this);
        } else if (this.level === "boneIsles") {
            boneIsles(this);
        } else {
            throw Error('Unknown level');
        }

        const overlay = new GameDebugOverlay(this.rapierWorld, this.pixiApp.ticker, this.pixiApp.stage, this.viewport);
        this.pixiApp.stage.addChildAt(this.rapierGfx, 0);

        this.pixiApp.ticker.add(() => {
            // TODO: Timing.
            const startTime = performance.now();
            this.world.step();
            overlay.physicsSamples.push(performance.now()-startTime);
        }, undefined, UPDATE_PRIORITY.HIGH);
    }

    public get canvas() {
        return this.pixiApp.canvas;
    }

    public destroy() {
        this.pixiApp.destroy();
    }
}