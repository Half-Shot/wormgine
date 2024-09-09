import { ColorSource, Container, Geometry, Graphics, Mesh, Shader, UPDATE_PRIORITY } from "pixi.js";
import { IGameEntity } from "./entity";
import { Vector } from "matter-js";
import { GradientShader } from "../shaders";
import { BitmapTerrain } from "./bitmapTerrain";

interface RainParticle {
    position: Vector;
    length: number;
    angle: number;
    speed: number;
}

const MAX_RAIN_LENGTH = 15;
const MIN_RAIN_LENGTH = 6;

export class Background implements IGameEntity {
    static create(width: number, height: number, color: [number, number, number, number], terrain: BitmapTerrain): Background {
        return new Background(width, height, color, terrain);
    }
    rainSpeed = 3;
    rainSpeedVariation = 1/2;
    rainCount = 175;
    rainColor: ColorSource = 'rgba(100,100,100,0.25)';
    priority = UPDATE_PRIORITY.LOW;

    gradientMesh: Mesh<Geometry, Shader>;

    rainGraphic = new Graphics();
    rainParticles: RainParticle[] = [];

    private constructor(private readonly viewWidth: number, private readonly viewHeight: number, color: [number, number, number, number], private readonly terrain: BitmapTerrain) {
        const halfViewWidth = viewWidth / 2;
        const halfViewHeight = viewHeight / 2;
        const geometry = new Geometry({
            attributes: {
                aVertexPosition:
                    [-halfViewWidth, -halfViewHeight, // x, y
                    halfViewWidth, -halfViewHeight, // x, y
                    halfViewWidth, halfViewHeight,
                    -halfViewWidth, halfViewHeight], // x, y
                aUvs: [0, 0, // u, v
                    1, 0, // u, v
                    1, 1,
                    0, 1]
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
                    //uStartColor: [1, 0, 0, 1],
                }
            })
        });
        
        this.gradientMesh.position.set(viewWidth/3, viewHeight/4);

        this.rainGraphic.position.set(0,0);
        // Create some rain
        const rainCount = this.rainCount;
        for (let rainIndex = 0; rainIndex < rainCount; rainIndex += 1) {
            this.addRainParticle();
        }
    }
    
    addRainParticle() {
        const x = Math.round(Math.random()*this.viewWidth);
        const y = (0-Math.round(Math.random()*this.viewHeight) - 200);
        this.rainParticles.push({
            position: Vector.create(x, y),
            length: MIN_RAIN_LENGTH + Math.round(Math.random()*(MAX_RAIN_LENGTH-MIN_RAIN_LENGTH)),
            angle: 1 + (Math.random()-0.5)*0.1,
            speed: (this.rainSpeed*(0.5 + (Math.random()*this.rainSpeedVariation)))
        });
    }

    addToWorld(parent: Container) {
        parent.addChild(this.gradientMesh);
        parent.addChild(this.rainGraphic);
    }

    get destroyed() {
        return this.gradientMesh.destroyed;
    }

    update(): void {
        this.rainGraphic.clear();
        for (let rainIndex = 0; rainIndex < this.rainParticles.length; rainIndex += 1) {
            const particle = this.rainParticles[rainIndex];
            if (particle.position.y > this.viewHeight) {
                // TODO: Properly detect terrain
                this.rainParticles.splice(rainIndex, 1);
                // TODO: And splash
                this.addRainParticle();
                continue;
            }

            if (this.terrain.pointInTerrain(particle.position, 2).length) {
                // TODO: Properly detect terrain
                this.rainParticles.splice(rainIndex, 1);
                // TODO: And splash
                this.addRainParticle();
                continue;

            }
            
            particle.position.x += particle.speed/4;
            particle.position.y += particle.speed;
            const lengthX = particle.position.x-particle.length;
            const lengthY = particle.position.y-(particle.length*particle.angle);
            this.rainGraphic.setStrokeStyle({ width: 3, color: this.rainColor }).moveTo(
                lengthX, lengthY
            ).lineTo(particle.position.x, particle.position.y);
        }
    }

    destroy(): void {
        this.gradientMesh.destroy();
    }
}