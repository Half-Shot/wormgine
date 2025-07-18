import {
  Container,
  FillGradient,
  Graphics,
  Point,
  UPDATE_PRIORITY,
  Texture,
  Buffer,
  BufferUsage,
  Geometry,
  Shader,
  Mesh,
  Color,
} from "pixi.js";
import { IGameEntity } from "./entity";
import { BitmapTerrain } from "./bitmapTerrain";
import { Viewport } from "pixi-viewport";
import { Coordinate, MetersValue } from "../utils";
import globalFlags from "../flags";
import { GameWorld } from "../world";
import { Observable } from "rxjs";
import { BackgroundPalettes } from "../color";

interface RainParticle {
  position: Point;
  length: number;
  angle: number;
  speed: number;
  wind: number;
}

const MAX_RAIN_LENGTH = 10;
const MIN_RAIN_LENGTH = 6;
const RAINDROP_COUNT = 200;
const WIND_ADJUST_EVERY_PARTICLE = 10;
const WIND_ADJUST_BY = 0.33;
const BASE_RAIN_SPEED = 20;

/**
 * Background of the game world. Includes rain particles.
 */
export class Background implements IGameEntity {
  priority = UPDATE_PRIORITY.LOW;

  private currentWind = 0;
  private targetWind = 0;
  private windAdjustParticleCount = 0;

  private gradientGraphics: Graphics;

  private rainParticles: RainParticle[] = [];
  private rainShader: Shader;
  instancePositionBuffer: Buffer;
  rainGeometry: Geometry;
  rainMesh: Mesh<Geometry, Shader>;

  private static vertexSrc: string;
  private static fragmentSrc: string;

  private palette = BackgroundPalettes[0];

  static async readAssets() {
    Background.vertexSrc = (await import("../shaders/rain.vert?raw")).default;
    Background.fragmentSrc = (await import("../shaders/rain.frag?raw")).default;
  }

  constructor(
    screenSize: Observable<{ width: number; height: number }>,
    private viewport: Viewport,
    private readonly terrain: BitmapTerrain,
    world: GameWorld,
    rainTexture: Texture,
    private readonly waterPosition: MetersValue,
  ) {
    this.gradientGraphics = new Graphics();
    world.wind$.subscribe((wind) => {
      this.targetWind = wind;
    });
    const rainCount = Math.ceil(RAINDROP_COUNT);
    this.rainShader = Shader.from({
      gl: {
        vertex: Background.vertexSrc,
        fragment: Background.fragmentSrc,
      },
      resources: {
        uTexture: rainTexture.source,
        uSampler: rainTexture.source.style,
        uniforms: {
          time: { value: 0, type: "f32" },
        },
      },
    });
    this.instancePositionBuffer = new Buffer({
      data: new Float32Array(rainCount * 3),
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });
    this.rainGeometry = new Geometry({
      attributes: {
        aPosition: [
          -12,
          -12, // top left
          12,
          -12, // top right
          12,
          12, // bottom right
          12,
          12, // bottom right
          -12,
          12, // bottom left
          -12,
          -12, // top left
        ],
        aUV: [
          0,
          0, // top left
          1,
          0, // top right
          1,
          1, // bottom right
          1,
          1, // bottom right
          0,
          1,
          0,
          0,
        ],
        aPositionOffset: {
          buffer: this.instancePositionBuffer,
          instance: true,
        },
        aColor: Array(6)
          .fill(new Color(this.palette.rainColor).toArray())
          .flat(),
      },
      instanceCount: rainCount,
    });
    this.rainMesh = new Mesh({
      geometry: this.rainGeometry,
      shader: this.rainShader,
    });
    screenSize.subscribe(({ width, height }) => {
      this.gradientGraphics.clear();
      const halfViewWidth = width / 2;
      const halfViewHeight = height / 2;
      const gradient = new FillGradient({
        type: "linear",
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: this.palette.gradient[0] },
          { offset: 1, color: this.palette.gradient[1] },
        ],
        textureSpace: "local",
      });
      this.gradientGraphics.rect(
        -halfViewWidth,
        -halfViewHeight,
        width,
        height,
      );
      this.gradientGraphics.fill(gradient);
      this.gradientGraphics.position.set(halfViewWidth, halfViewHeight);
      // Create some rain
      const rainDelta = rainCount - this.rainParticles.length;
      if (rainDelta > 0) {
        for (let rainIndex = 0; rainIndex < rainDelta; rainIndex += 1) {
          this.addRainParticle(true);
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
      buffer[count++] = particle.angle;
    }
    this.instancePositionBuffer.update();
    this.rainShader.resources.uniforms.uniforms.time += 0.01 * this.currentWind;
    if (Math.abs(this.rainShader.resources.uniforms.uniforms.time) > Math.PI) {
      this.rainShader.resources.uniforms.uniforms.time = 0;
    }
  }

  addRainParticle(initial = false) {
    const x =
      this.viewport.center.x +
      Math.round(Math.random() * this.viewport.screenWidth) -
      this.viewport.screenWidth / 2;
    const y = initial
      ? this.viewport.center.y +
        (0 - Math.round(Math.random() * this.viewport.screenHeight) - 200)
      : this.viewport.center.y - this.viewport.screenHeight;
    const windAdjust = Math.max(0.33, Math.abs(this.currentWind) / 10);
    this.rainParticles.push({
      position: new Point(x, y),
      length:
        MIN_RAIN_LENGTH +
        Math.round(Math.random() * (MAX_RAIN_LENGTH - MIN_RAIN_LENGTH)),
      angle: (Math.random() - 0.5) * 15,
      speed: windAdjust * BASE_RAIN_SPEED,
      wind: this.currentWind,
    });
    if (Math.abs(this.targetWind - this.currentWind) > WIND_ADJUST_BY) {
      if (this.windAdjustParticleCount > WIND_ADJUST_EVERY_PARTICLE) {
        this.windAdjustParticleCount = 0;
        const adjustment =
          this.targetWind > this.currentWind ? WIND_ADJUST_BY : -WIND_ADJUST_BY;
        this.currentWind += adjustment;
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
    const maxX =
      this.viewport.center.x + this.viewport.screenWidthInWorldPixels / 2;
    const minX =
      this.viewport.center.x - this.viewport.screenWidthInWorldPixels / 2;

    if (globalFlags.DebugView) {
      // Don't render during debug view.
      return;
    }
    const waterPos = this.waterPosition.pixels;
    for (
      let rainIndex = 0;
      rainIndex < this.rainParticles.length;
      rainIndex += 1
    ) {
      const particle = this.rainParticles[rainIndex];
      // Out of viewport
      if (
        particle.position.y > waterPos ||
        particle.position.x > maxX ||
        particle.position.x < minX
      ) {
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
      const anglularVelocity = (particle.wind + particle.angle) * 0.15;
      particle.position.x += anglularVelocity;
      particle.position.y += 4;
    }

    this.updateInstanceBuffer();
  }

  destroy(): void {
    this.gradientGraphics.destroy();
  }
}
