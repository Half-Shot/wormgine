import { Composite, Body, Bodies } from "matter-js";
import { Container, Geometry, Graphics, Mesh, Program, Rectangle, Shader, UPDATE_PRIORITY } from "pixi.js";
import { IGameEntity } from "./entity";

const shader = Program.from(`

precision mediump float;
attribute vec2 waterVertexPos;

uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
uniform float     iTime;

void main() {
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(waterVertexPos, 1.0)).xy, 0.0, 1.0);
	gl_Position.y += sin(iTime+waterVertexPos.x*0.125)*0.005;
}`,

`precision mediump float;

    void main() {
        gl_FragColor = vec4(0.1, 0.1, 0.7, 0.9);
    }

`);

export class Water implements IGameEntity {
    public readonly priority: UPDATE_PRIORITY = UPDATE_PRIORITY.HIGH;
    private readonly geometry: Geometry;
    private readonly shader: Shader;
    public get destroyed() {
        return this.gfx.destroyed;
    }

    private readonly gfx: Graphics = new Graphics();
    private readonly body: Body;

    entityOwnsBody(bodyId: number): boolean {
        return this.body?.id === bodyId;
    }

    constructor(private readonly width: number, private readonly height: number) {
        this.geometry = new Geometry();
        const indicies = new Array('a','b').flatMap((_v, i) => {
            i = i * 3;
            if (i === 0) {
                return [
                    i, i+1, i+2,
                    i, i+2, i+3,
                ]
            } else {
                return [
                    i, i-1, i+1,
                    i, i+1, i+2,
                ]
            }
        });
        this.geometry.addAttribute('waterVertexPos',  [
                -600, -50, // top left
                -600, 50, // bottom left
                0, 50, // bottom middle
                0, -50, // top middle
                600, 50, // bottom right
                600, -50, // top right
        ], 2).addIndex(indicies);
        this.shader = new Shader(shader);
        this.body = Bodies.rectangle(width/2,height-60,width,100, { isStatic: true });
    }

    async create(parent: Container, engine: Composite) {
        const segmentSize = 50;
        parent.addChild(this.gfx);
        const waterMesh = new Mesh(this.geometry, this.shader);
        this.shader.uniforms['iTime'] = performance.now();
        waterMesh.position.set(this.width / 2, this.body.bounds.min.y + 60);
        waterMesh.scale.set(3.2, 1.5);
        parent.addChild(waterMesh);
        Composite.add(engine, this.body);
    }

    update(dt: number): void {
        this.shader.uniforms['iTime'] = performance.now() / 1000;

        this.gfx.clear();
        this.gfx.lineStyle(1, 0xFFBD01, 1);
        const gfxR = new Rectangle(
            this.body.bounds.min.x,
            this.body.bounds.min.y,
            this.body.bounds.max.x - this.body.bounds.min.x,
            this.body.bounds.max.y - this.body.bounds.min.y
        );
        this.gfx.drawShape(gfxR);
    }

    destroy(): void {
        this.gfx.destroy();
    }
}