import {
  ColorSource,
  Container,
  FillGradient,
  Graphics,
  Point,
  UPDATE_PRIORITY,
  Text,
  Renderer,
  Texture,
  GraphicsContext,
  Buffer,
  BufferUsage,
  Geometry,
  Shader,
  Mesh,
} from "pixi.js";
import { IGameEntity } from "./entity";
import { BitmapTerrain } from "./bitmapTerrain";
import { Viewport } from "pixi-viewport";
import { Coordinate } from "../utils";
import globalFlags from "../flags";
import { GameWorld } from "../world";
import { Observable } from "rxjs";
import Logger from "../log";

interface RainParticle {
  position: Point;
  length: number;
  angle: number;
  speed: number;
  wind: number;
}

const MAX_RAIN_LENGTH = 10;
const MIN_RAIN_LENGTH = 6;
const RAINDROP_COUNT = 350;
const WIND_ADJUST_EVERY_PARTICLE = 10;
const WIND_ADJUST_BY = 0.33;

const log = new Logger("Background");

/**
 * Background of the game world. Includes rain particles.
 */
export class Background implements IGameEntity {
  private rainSpeed = 5;
  private rainSpeedVariation = 0.65;
  private rainColor: ColorSource = "rgba(100,100,100,0.33)";
  priority = UPDATE_PRIORITY.LOW;

  private currentWind = 0;
  private targetWind = 0;
  private windAdjustParticleCount = 0;

  private gradientGraphics: Graphics;

  private rainGraphic: Graphics;
  private rainGraphicContext = new GraphicsContext();
  private rainParticles: RainParticle[] = [];
  private emoji?: Texture;
  instancePositionBuffer: Buffer;
  rainGeometry: Geometry;
  rainMesh: Mesh<Geometry, Shader>;

  private static vertexSrc: string;
  private static fragmentSrc: string;

  static async readAssets() {
    Background.vertexSrc = (await import("../shaders/rain.vert?raw")).default;
    Background.fragmentSrc = (await import("../shaders/rain.frag?raw")).default;
  }

  constructor(
    screenSize: Observable<{ width: number; height: number }>,
    private viewport: Viewport,
    private readonly terrain: BitmapTerrain,
    world: GameWorld,
    renderer: Renderer,
    emojiRain: string,
  ) {
    this.rainGraphic = new Graphics(this.rainGraphicContext);
    this.gradientGraphics = new Graphics();
    world.wind$.subscribe((wind) => {
      this.targetWind = wind;
    });
    const rainCount = Math.ceil(RAINDROP_COUNT);
    const emojiText = new Text({ text: "💧", style: {
      fill: 0xFFFFFF,
      fontFamily: 'Arial',
      fontSize: 16 } });
    this.emoji = renderer.generateTexture(emojiText);
    const shader = Shader.from({
        gl: {
          vertex: Background.vertexSrc,
          fragment: Background.fragmentSrc
        },
        resources: {
            uTexture: this.emoji.source,
            uSampler: this.emoji.source.style,
            waveUniforms: {
                time: { value: 1, type: 'f32' },
            },
        },
    });
    this.instancePositionBuffer = new Buffer({
      data: new Float32Array(rainCount * 2),
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });
    this.rainGeometry = new Geometry({
        attributes: {
            aPosition: [
                -10,
                -10, // x, y
                10,
                -10, // x, y
                10,
                10,
            ],
            aUV: [
                0,
                0, // u, v
                1,
                0, // u, v
                1,
                1,
                0,
                1,
            ],
            aPositionOffset: {
                buffer: this.instancePositionBuffer,
                instance: true,
            },
        },
        instanceCount: rainCount,
    });
    this.rainMesh = new Mesh({
        geometry: this.rainGeometry,
        shader,
    });
    screenSize.subscribe(({ width, height }) => {
      this.gradientGraphics.clear();
      const halfViewWidth = width / 2;
      const halfViewHeight = height / 2;
      const gradient = new FillGradient({type: 'linear', start: {x: 0, y: -halfViewWidth}, end: {x: 0, y: height}});
      gradient.addColorStop(0, "rgba(3, 0, 51, 0.9)");
      gradient.addColorStop(1, "rgba(39, 0, 5, 0.9)");
      this.gradientGraphics.rect(-halfViewWidth, -halfViewHeight, width, height);
      this.gradientGraphics.fill(gradient);
      this.gradientGraphics.position.set(halfViewWidth, halfViewHeight);
      this.rainGraphic.position.set(0, 0);
      // Create some rain
      const rainDelta = rainCount - this.rainParticles.length;
      if (rainDelta > 0) {
        for (let rainIndex = 0; rainIndex < rainDelta; rainIndex += 1) {
          this.addRainParticle();
        }
      } else {
        this.rainParticles.splice(0, Math.abs(rainDelta));
      }
      this.updateInstanceBuffer();
    });
  }

  public updateInstanceBuffer() {
    const buffer = this.instancePositionBuffer.data;
    let count = 0;
    for (const particle of this.rainParticles) {
      buffer[count++] = particle.position.x;
      buffer[count++] = particle.position.y;
    }
    this.instancePositionBuffer.update();
  }

  addRainParticle() {
    const x =
      this.viewport.center.x +
      Math.round(Math.random() * this.viewport.screenWidth) -
      this.viewport.screenWidth / 2;
    const y =
      this.viewport.center.y +
      (0 - Math.round(Math.random() * this.viewport.screenHeight) - 200);
    this.rainParticles.push({
      position: new Point(x, y),
      length:
        MIN_RAIN_LENGTH +
        Math.round(Math.random() * (MAX_RAIN_LENGTH - MIN_RAIN_LENGTH)),
      angle: (Math.random() - 0.5) * 15,
      speed: this.rainSpeed * (0.5 + Math.random() * this.rainSpeedVariation),
      wind: this.currentWind,
    });
    if (Math.abs(this.targetWind - this.currentWind) > WIND_ADJUST_BY) {
      log.debug("Background wind off", this.targetWind, this.currentWind);
      if (this.windAdjustParticleCount > WIND_ADJUST_EVERY_PARTICLE) {
        this.windAdjustParticleCount = 0;
        const adjustment =
          this.targetWind > this.currentWind ? WIND_ADJUST_BY : -WIND_ADJUST_BY;
        this.currentWind += adjustment;
        log.debug("Wind adjusted", this.currentWind);
      } else {
        this.windAdjustParticleCount++;
      }
    }
  }

  addToWorld(worldContainer: Container, viewport: Container) {
    worldContainer.addChildAt(this.gradientGraphics, 0);
    viewport.addChildAt(this.rainMesh, 0);
  }

  get destroyed() {
    return this.gradientGraphics.destroyed;
  }

  update(): void {
    if (globalFlags.DebugView) {
      // Don't render during debug view.
      this.rainGraphic.clear();
      return;
    }
    this.rainGraphic.clear();
    for (
      let rainIndex = 0;
      rainIndex < this.rainParticles.length;
      rainIndex += 1
    ) {
      const particle = this.rainParticles[rainIndex];
      // Hit water
      if (particle.position.y > 900) {
        // TODO: Properly detect terrain
        this.rainParticles.splice(rainIndex, 1);
        // TODO: And splash
        this.addRainParticle();
        continue;
      }

      if (
        this.terrain.pointInTerrain(
          Coordinate.fromScreen(particle.position.x, particle.position.y),
        )
      ) {
        // TODO: Properly detect terrain
        this.rainParticles.splice(rainIndex, 1);
        // TODO: And splash
        this.addRainParticle();
        continue;
      }
      const anglularVelocity = particle.wind + particle.angle * 0.1;
      particle.position.x += anglularVelocity;
      particle.position.y += particle.speed;
    //   if (this.emoji) {
    //     this.rainGraphicContext
    //     .stroke({ width: 2, color: this.rainColor })
    //     .texture(this.emoji, 0xFFFFFF, particle.position.x, particle.position.y);
    //   } else {
    //     const lengthX = particle.position.x + anglularVelocity * 1;
    //     const lengthY = particle.position.y - particle.length + anglularVelocity;
    //     this.rainGraphic
    //       .stroke({ width: 2, color: this.rainColor })
    //       .moveTo(particle.position.x, lengthY)
    //       .lineTo(lengthX, particle.position.y);
    //   }
    }
    this.updateInstanceBuffer();
  }

  destroy(): void {
    this.gradientGraphics.destroy();
  }
}
