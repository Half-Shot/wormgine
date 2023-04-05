import { Container, DisplayObject, Geometry, Graphics, Mesh, Shader, UPDATE_PRIORITY } from "pixi.js";
import { IGameEntity } from "./entity";
import { Composite, Vector } from "matter-js";
import { GradientShader } from "../shaders";
import { BitmapTerrain } from "./bitmapTerrain";


export class Background implements IGameEntity {
    static create(width: number, height: number, color: [number, number, number, number], terrain: BitmapTerrain): Background {
        return new Background(width, height, color, terrain);
    }

    geometry: Geometry;
    priority = UPDATE_PRIORITY.LOW;

    gradientShader: Shader;
    gradientMesh: Mesh<Shader>;

    rainGraphic = new Graphics();
    rainParticles: Vector[] = [];

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
        const rainCount = Math.round(viewWidth * Math.random()) / 40;
        for (let rainIndex = 0; rainIndex < rainCount; rainIndex += 1) {
            const x = Math.round(Math.random()*viewWidth);
            const y = 0-Math.round(Math.random()*viewHeight);
            this.rainParticles.push(Vector.create(x, y));
        }
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
            if (particle.y > this.viewHeight) {
                // TODO: Properly detect terrain
                this.rainParticles.splice(rainIndex, 1);
                // TODO: And splash
                const x = Math.round(Math.random()*this.viewWidth);
                this.rainParticles.push(Vector.create(x, 0));
                continue;
            }

            if (this.terrain.pointInTerrain(particle, 2).length) {
                // TODO: Properly detect terrain
                this.rainParticles.splice(rainIndex, 1);
                // TODO: And splash
                const x = Math.round(Math.random()*this.viewWidth);
                this.rainParticles.push(Vector.create(x, 0));
                continue;

            }
            
            particle.x += 0.25;
            particle.y += 2;
            this.rainGraphic.lineStyle(3, 'rgb(255,255,255)').moveTo(particle.x-4, particle.y-8).lineTo(particle.x, particle.y);
        }
    }

    destroy(): void {
        this.gradientMesh.destroy();
    }
}