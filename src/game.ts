import { Application, Graphics, Ticker, UPDATE_PRIORITY } from "pixi.js";
import { Viewport } from "pixi-viewport";
import { getAssets } from "./assets";
import { GameDebugOverlay } from "./overlays/debugOverlay";
import { GameWorld } from "./world";
import RAPIER from "@dimforge/rapier2d-compat";
import { readAssetsForEntities } from "./entities";
import { readAssetsForWeapons } from "./weapons";
import { WindDial } from "./overlays/windDial";
import { GameReactChannel } from "./interop/gamechannel";
import staticController from "./input";
import { sound } from "@pixi/sound";
import Logger from "./log";
import { CriticalGameError } from "./errors";
import { getGameSettings } from "./settings";
import { NetGameWorld } from "./net/netGameWorld";
import {
  BehaviorSubject,
  debounceTime,
  filter,
  fromEvent,
  map,
  merge,
  Observable,
  of,
} from "rxjs";
import { IRunningGameInstance } from "./logic/gameinstance";
import { RunningNetGameInstance } from "./net/netgameinstance";
import { PlayableEntity } from "./entities/playable/playable";
import globalFlags from "./flags";

const worldWidth = 1920;
const worldHeight = 1080;

// Run physics engine at 90fps.
const tickEveryMs = 1000 / 90;

const logger = new Logger("Game");

export class Game<ReloadedGameState extends object = object> {
  public readonly viewport: Viewport;
  private readonly rapierWorld: RAPIER.World;
  public readonly world: GameWorld;
  public readonly rapierGfx: Graphics;
  public readonly screenSize$: Observable<{ width: number; height: number }>;
  private readonly ready = new BehaviorSubject(false);
  public readonly ready$ = this.ready.asObservable();
  private lastPhysicsTick: number = 0;
  public overlay?: GameDebugOverlay;
  private readonly reloadState = new BehaviorSubject<ReloadedGameState | null>(
    null,
  );
  public readonly needsReload$ = this.reloadState.pipe(filter((s) => !!s));

  public get pixiRoot() {
    return this.viewport;
  }

  public static async create<ReloadedGameState extends object>(
    window: Window,
    scenario: string,
    gameReactChannel: GameReactChannel<ReloadedGameState>,
    gameInstance: IRunningGameInstance,
    level?: string,
    previousGameState?: ReloadedGameState,
  ): Promise<Game<ReloadedGameState>> {
    await RAPIER.init();
    const pixiApp = new Application();
    await pixiApp.init({
      resizeTo: window,
      preference: "webgpu",
      antialias: true,
      hello: true,
      renderableGCActive: false, //  try to disable auto GC probably causing TilledSprite
      //  'Uncaught TypeError: Cannot read properties of undefined (reading 'indices')'
    });
    return new Game(
      pixiApp,
      scenario,
      gameReactChannel,
      gameInstance,
      level,
      previousGameState,
    );
  }

  constructor(
    public readonly pixiApp: Application,
    private readonly scenario: string,
    public readonly gameReactChannel: GameReactChannel<ReloadedGameState>,
    public readonly netGameInstance: IRunningGameInstance,
    public readonly level?: string,
    public readonly previousGameState?: ReloadedGameState,
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
    this.world =
      netGameInstance instanceof RunningNetGameInstance
        ? new NetGameWorld(
            this.rapierWorld,
            this.pixiApp.ticker,
            netGameInstance,
          )
        : new GameWorld(this.rapierWorld, this.pixiApp.ticker);
    this.pixiApp.stage.addChild(this.viewport);
    this.viewport.decelerate().drag();
    this.viewport.zoom(8);
    sound.volumeAll = getGameSettings().soundEffectVolume;

    // TODO: Bit of a hack?
    staticController.bindInput();

    this.screenSize$ = merge(
      of({}),
      fromEvent(globalThis, "resize").pipe(debounceTime(5)),
    ).pipe(
      map(() => ({
        width: pixiApp.screen.width,
        height: pixiApp.screen.height,
      })),
    );
  }

  private async loadResources() {
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

    await this.loadResources();

    this.overlay = new GameDebugOverlay(
      this.rapierWorld,
      this.pixiApp.ticker,
      this.pixiApp.stage,
      this.viewport,
      undefined,
    );

    try {
      logger.info(`Loading scenario ${this.scenario}`);
      const module = await import(`./scenarios/${this.scenario}.ts`);
      await module.default(this);
    } catch (ex) {
      throw new CriticalGameError(
        ex instanceof Error ? ex : Error("Scenario could not be loaded"),
      );
    }

    this.pixiApp.stage.addChildAt(this.rapierGfx, 0);
    this.ready.next(true);
    globalFlags.wormInstances = this.world.entities
      .values()
      .filter((e) => e instanceof PlayableEntity)
      .map((e) => e.wormIdent)
      .toArray();

    import.meta.hot?.on("vite:beforeUpdate", this.hotReload);

    this.pixiApp.ticker.add(this.tickWorld, undefined, UPDATE_PRIORITY.HIGH);
  }

  public get canvas() {
    return this.pixiApp.canvas;
  }

  public tickWorld = (dt: Ticker) => {
    const startTime = performance.now();
    this.lastPhysicsTick += dt.deltaMS;
    if (this.lastPhysicsTick >= tickEveryMs * 3) {
      logger.warning("Game engine is lagging behind target update rate");
    }
    // Note: If we are lagging behind terribly, this will run multiple ticks
    while (this.lastPhysicsTick >= tickEveryMs) {
      this.world.step();
      this.lastPhysicsTick -= tickEveryMs;
    }
    this.overlay?.physicsSamples.push(performance.now() - startTime);
    this.world.updateEntities(dt);
  };

  public destroy() {
    import.meta.hot?.off("vite:beforeUpdate", this.hotReload);
    this.overlay?.destroy();
    this.pixiApp.destroy();
    this.rapierWorld.free();
  }

  public hotReload = () => {
    logger.info("hot reload requested, saving game state");
    this.pixiApp.ticker.stop();
    const handler = async () => {
      const state = await this.gameReactChannel.saveGameState();
      this.destroy();
      logger.info("game state saved, ready to reload");
      this.reloadState.next(state);
    };
    void handler();
  };
}
