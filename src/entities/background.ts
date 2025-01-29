import {
  ColorSource,
  Container,
  FillGradient,
  Graphics,
  Point,
  UPDATE_PRIORITY,
} from "pixi.js";
import { IGameEntity } from "./entity";
import { BitmapTerrain } from "./bitmapTerrain";
import { Viewport } from "pixi-viewport";
import { Coordinate } from "../utils";
import globalFlags from "../flags";
import { GameWorld } from "../world";
import { Observable } from "rxjs";

interface RainParticle {
  position: Point;
  length: number;
  angle: number;
  speed: number;
}

const MAX_RAIN_LENGTH = 15;
const MIN_RAIN_LENGTH = 6;
const RAINDROP_COUNT = 350;

/**
 * Background of the game world. Includes rain particles.
 */
export class Background implements IGameEntity {
  static create(
    screenSize: Observable<{ width: number; height: number }>,
    viewport: Viewport,
    terrain: BitmapTerrain,
    world: GameWorld,
  ): Background {
    return new Background(screenSize, viewport, terrain, world);
  }
  private rainSpeed = 5;
  private rainSpeedVariation = 1;
  private rainColor: ColorSource = "rgba(100,100,100,0.33)";
  priority = UPDATE_PRIORITY.LOW;

  private gradientMesh: Graphics;

  private rainGraphic = new Graphics();
  private rainParticles: RainParticle[] = [];

  private constructor(
    private readonly screenSize: Observable<{ width: number; height: number }>,
    private viewport: Viewport,
    private readonly terrain: BitmapTerrain,
    private readonly world: GameWorld,
  ) {
    this.gradientMesh = new Graphics();
    screenSize.subscribe(({ width, height }) => {
      this.gradientMesh.clear();
      const halfViewWidth = width / 2;
      const halfViewHeight = height / 2;
      const gradient = new FillGradient(0, -halfViewWidth, 0, height);
      gradient.addColorStop(0, "rgba(3, 0, 51, 0.9)");
      gradient.addColorStop(1, "rgba(39, 0, 5, 0.9)");
      this.gradientMesh.rect(-halfViewWidth, -halfViewHeight, width, height);
      this.gradientMesh.fill(gradient);
      this.gradientMesh.position.set(halfViewWidth, halfViewHeight);
      this.rainGraphic.position.set(0, 0);
      // Create some rain
      const rainCount = Math.ceil(RAINDROP_COUNT * (width / 1920));
      const rainDelta = rainCount - this.rainParticles.length;
      if (rainDelta > 0) {
        for (let rainIndex = 0; rainIndex < rainDelta; rainIndex += 1) {
          this.addRainParticle();
        }
      } else {
        this.rainParticles.splice(0, Math.abs(rainDelta));
      }
    });
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
    });
  }

  addToWorld(worldContainer: Container, viewport: Container) {
    worldContainer.addChildAt(this.gradientMesh, 0);
    viewport.addChildAt(this.rainGraphic, 0);
  }

  get destroyed() {
    return this.gradientMesh.destroyed;
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
      const anglularVelocity = this.world.wind + particle.angle * 0.1;
      particle.position.x += anglularVelocity;
      particle.position.y += particle.speed;
      const lengthX = particle.position.x + anglularVelocity * 5;
      const lengthY = particle.position.y - particle.length + anglularVelocity;
      this.rainGraphic
        .stroke({ width: 2, color: this.rainColor })
        .moveTo(particle.position.x, lengthY)
        .lineTo(lengthX, particle.position.y);
    }
  }

  destroy(): void {
    this.gradientMesh.destroy();
  }
}
