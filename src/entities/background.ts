import { ColorSource, Container, DisplayObject, Geometry, Graphics, Mesh, Shader, UPDATE_PRIORITY } from "pixi.js";
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

    geometry: Geometry;
    priority = UPDATE_PRIORITY.LOW;

    gradientShader: Shader;
    gradientMesh: Mesh<Shader>;

    rainGraphic = new Graphics();
    rainParticles: RainParticle[] = [];

    private constructor(private readonly viewWidth: number, private readonly viewHeight: number, color: [number, number, number, number], private readonly terrain: BitmapTerrain) {
        const halfViewWidth = viewWidth / 2;
        const halfViewHeight = viewHeight / 2;
        this.geometry = new Geometry()
        .addAttribute('aVertexPosition', // the attribute name
            [-halfViewWidth, -halfViewHeight, // x, y
            halfViewWidth, -halfViewHeight, // x, y
            halfViewWidth, halfViewHeight,
                -halfViewWidth, halfViewHeight], // x, y
            2) // the size of the attribute
        .addAttribute('aUvs', // the attribute name
            [0, 0, // u, v
                1, 0, // u, v
                1, 1,
                0, 1], // u, v
            2) // the size of the attribute
        .addIndex([0, 1, 2, 0, 2, 3]);

        this.gradientShader = new Shader(GradientShader);
        this.gradientShader.uniforms['startColor'] = color.map(v => v/255);
        this.gradientMesh = new Mesh(this.geometry, this.gradientShader);
        this.gradientMesh.position.set(viewWidth/2, viewHeight/2);

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

    addToWorld(parent: Container<DisplayObject>) {
        parent.addChild(this.gradientMesh);
        parent.addChild(this.rainGraphic);
    }

    get destroyed() {
        return this.gradientMesh.destroyed;
    }

    update(dt: number): void {
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
            this.rainGraphic.lineStyle(3, this.rainColor).moveTo(
                lengthX, lengthY
            ).lineTo(particle.position.x, particle.position.y);
        }
    }

    destroy(): void {
        this.gradientMesh.destroy();
    }
}