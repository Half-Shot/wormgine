import { Application, Graphics, UPDATE_PRIORITY } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { getAssets } from "./assets";
import { GameDebugOverlay } from "./overlays/debugOverlay";
import { GameWorld } from "./world";
import RAPIER from "@dimforge/rapier2d-compat";
import { readAssetsForEntities } from "./entities";
import { Team } from "./logic/teams";
import { readAssetsForWeapons } from "./weapons";
import { WindDial } from "./overlays/windDial";
import { RunningNetGameInstance } from "./net/client";
import { GameReactChannel } from "./interop/gamechannel";
import staticController from "./input";
import { sound } from "@pixi/sound";
import Logger from "./log";
import { CriticalGameError } from "./errors";
import { getGameSettings } from "./settings";
import { NetGameWorld } from "./net/netGameWorld";

const worldWidth = 1920;
const worldHeight = 1080;

const logger = new Logger("Game");

export class Game {
  public readonly viewport: Viewport;
  private readonly rapierWorld: RAPIER.World;
  public readonly world: GameWorld;
  public readonly rapierGfx: Graphics;

  public get pixiRoot() {
    return this.viewport;
  }

  public static async create(
    window: Window,
    scenario: string,
    gameReactChannel: GameReactChannel,
    level?: string,
    netGameInstance?: RunningNetGameInstance,
  ): Promise<Game> {
    await RAPIER.init();
    const pixiApp = new Application();
    await pixiApp.init({ resizeTo: window, preference: "webgl" });
    return new Game(
      pixiApp,
      scenario,
      gameReactChannel,
      level,
      netGameInstance,
    );
  }

  constructor(
    public readonly pixiApp: Application,
    private readonly scenario: string,
    public readonly gameReactChannel: GameReactChannel,
    public readonly level?: string,
    public readonly netGameInstance?: RunningNetGameInstance,
  ) {
    // TODO: Set a sensible static width/height and have the canvas pan it.
    this.rapierWorld = new RAPIER.World({ x: 0, y: 9.81 });
    this.rapierGfx = new Graphics();
    this.viewport = new Viewport({
      screenHeight: this.pixiApp.screen.height,
      screenWidth: this.pixiApp.screen.width,
      worldWidth: worldWidth,

      // TODO: Needs increasing
      worldHeight: worldHeight,
      // the interaction module is important for wheel to work properly when renderer.view is placed or scaled
      events: this.pixiApp.renderer.events,
    });
    this.world = netGameInstance
      ? new NetGameWorld(this.rapierWorld, this.pixiApp.ticker, netGameInstance)
      : new GameWorld(this.rapierWorld, this.pixiApp.ticker);
    this.pixiApp.stage.addChild(this.viewport);
    this.viewport.decelerate().drag();
    this.viewport.zoom(8);
    sound.volumeAll = getGameSettings().soundEffectVolume;

    // TODO: Bit of a hack?
    staticController.bindInput();
  }

  public goToMenu(winningTeams?: Team[]) {
    this.pixiApp.destroy();
    this.gameReactChannel.goToMenu(winningTeams);
  }

  public async loadResources() {
    const assetPack = getAssets();
    await readAssetsForEntities(assetPack);
    readAssetsForWeapons(assetPack);
    WindDial.loadAssets(assetPack.textures);
  }

  public async run() {
    // Load this scenario
    if (this.scenario.replaceAll(/[A-Za-z]/g, "") !== "") {
      throw new CriticalGameError(Error("Invalid level name"));
    }
    try {
      logger.info(`Loading scenario ${this.scenario}`);
      const module = await import(`./scenarios/${this.scenario}.ts`);
      await module.default(this);
    } catch (ex) {
      throw new CriticalGameError(
        ex instanceof Error ? ex : Error("Scenario could not be loaded"),
      );
    }

    const overlay = new GameDebugOverlay(
      this.rapierWorld,
      this.pixiApp.ticker,
      this.pixiApp.stage,
      this.viewport,
      undefined,
    );
    this.pixiApp.stage.addChildAt(this.rapierGfx, 0);

    // Run physics engine at 90fps.
    const tickEveryMs = 1000 / 90;
    let lastPhysicsTick = 0;

    this.pixiApp.ticker.add(
      (dt) => {
        // TODO: Timing.
        const startTime = performance.now();
        lastPhysicsTick += dt.deltaMS;
        // Note: If we are lagging behind terribly, this will multiple ticks
        while (lastPhysicsTick >= tickEveryMs) {
          this.world.step();
          lastPhysicsTick -= tickEveryMs;
        }
        overlay.physicsSamples.push(performance.now() - startTime);
      },
      undefined,
      UPDATE_PRIORITY.HIGH,
    );
  }

  public get canvas() {
    return this.pixiApp.canvas;
  }

  public destroy() {
    this.pixiApp.destroy();
  }
}
