import { ColorSource, Container, Geometry, Graphics, Mesh, Point, Shader, UPDATE_PRIORITY } from "pixi.js";
import { IGameEntity } from "./entity";
import { GradientShader } from "../shaders";
import { BitmapTerrain } from "./bitmapTerrain";
import { Viewport } from "pixi-viewport";
import { Coordinate } from "../utils";

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
    static create(viewWidth: number, viewHeight: number, viewport: Viewport, color: [number, number, number, number], terrain: BitmapTerrain): Background {
        return new Background(viewWidth, viewHeight, viewport, color, terrain);
    }
    private rainSpeed = 15;
    private rainSpeedVariation = 1;
    // TODO: Constrain to size of screen.
    private windDirection = 5;
    private rainColor: ColorSource = 'rgba(100,100,100,0.33)';
    priority = UPDATE_PRIORITY.LOW;

    private gradientMesh: Mesh<Geometry, Shader>;

    private rainGraphic = new Graphics();
    private rainParticles: RainParticle[] = [];

    private constructor(viewWidth: number, viewHeight: number, private viewport: Viewport, color: [number, number, number, number], private readonly terrain: BitmapTerrain) {
        const halfViewWidth = viewWidth / 2;
        const halfViewHeight = viewHeight / 2;
        const geometry = new Geometry({
            attributes: {
                aVertexPosition:
                    [-halfViewWidth, -halfViewHeight, // x, y
                    halfViewWidth, -halfViewHeight, // x, y
                    halfViewWidth, halfViewHeight,
                    -halfViewWidth, halfViewHeight], // x, y
            },
            indexBuffer: [0, 1, 2, 0, 2, 3]
        });

        this.gradientMesh = new Mesh({
            geometry,
            shader: new Shader({
                glProgram: GradientShader,
                resources: {
                    uniforms: {
                        uStartColor: { value: new Float32Array(color.map(v => v/255)), type: 'vec4<f32>' },
                    }
                }
            })
        });
        
        this.gradientMesh.position.set(halfViewWidth, halfViewHeight);
        this.rainGraphic.position.set(0,0);
        // Create some rain
        const rainCount = Math.ceil(RAINDROP_COUNT * (viewWidth/1920));
        for (let rainIndex = 0; rainIndex < rainCount; rainIndex += 1) {
            this.addRainParticle();
        }
        console.log('Generating', rainCount, 'particles');
    }
    
    addRainParticle() {
        const x = this.viewport.center.x + Math.round(Math.random()*this.viewport.screenWidth) - this.viewport.screenWidth/2;
        const y = this.viewport.center.y + (0-Math.round(Math.random()*this.viewport.screenHeight) - 200);
        this.rainParticles.push({
            position: new Point(x,y),
            length: MIN_RAIN_LENGTH + Math.round(Math.random()*(MAX_RAIN_LENGTH-MIN_RAIN_LENGTH)),
            angle: (Math.random()-0.5)* 15,
            speed: (this.rainSpeed*(0.5 + (Math.random()*this.rainSpeedVariation)))
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
        this.rainGraphic.clear();
        for (let rainIndex = 0; rainIndex < this.rainParticles.length; rainIndex += 1) {
            const particle = this.rainParticles[rainIndex];
            // Hit water
            if (particle.position.y > 900) {
                // TODO: Properly detect terrain
                this.rainParticles.splice(rainIndex, 1);
                // TODO: And splash
                this.addRainParticle();
                continue;
            }

            if (this.terrain.pointInTerrain(Coordinate.fromScreen(particle.position.x, particle.position.y))) {
                // TODO: Properly detect terrain
                this.rainParticles.splice(rainIndex, 1);
                // TODO: And splash
                this.addRainParticle();
                continue;
            }
            const anglularVelocity = particle.angle*0.1;
            particle.position.x += this.windDirection + anglularVelocity;
            particle.position.y += particle.speed;
            const lengthX = particle.position.x + (anglularVelocity*5);
            const lengthY = particle.position.y - particle.length + anglularVelocity;
            this.rainGraphic.stroke({ width: 2, color: this.rainColor }).moveTo(
                particle.position.x, lengthY
            ).lineTo(lengthX, particle.position.y)
        }
    }

    destroy(): void {
        this.gradientMesh.destroy();
    }
}