import { Composite, Body, Bodies } from "matter-js";
import { Container, Geometry, GlProgram, Mesh, Shader, UPDATE_PRIORITY } from "pixi.js";
import { IGameEntity } from "./entity";

const glProgram = GlProgram.from({vertex: `
precision mediump float;

in vec2 aPosition;
in vec2 aUV;

out vec2 vUV;

uniform mat3 translationMatrix;
uniform mat3 projectionMatrix;
uniform float     iTime;

void main() {
    gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
	gl_Position.y += sin(iTime+aPosition.x*0.125)*0.005;
    vUV = aUV;
}`,

fragment: `precision mediump float;

    void main() {
        gl_FragColor = vec4(0.1, 0.1, 0.7, 0.9);
    }

`, name: 'water'});

export class Water implements IGameEntity {
    public readonly priority: UPDATE_PRIORITY = UPDATE_PRIORITY.LOW;
    private readonly geometry: Geometry;
    public get destroyed() {
        return false;
    }

    private readonly body: Body;
    private shader?: Shader;

    entityOwnsBody(bodyId: number): boolean {
        return this.body?.id === bodyId;
    }

    constructor(private readonly width: number, private readonly height: number) {
        this.geometry = new Geometry({
            attributes: {
                aPosition: [
                    -100,
                    -100, // x, y
                    100,
                    -100, // x, y
                    100,
                    100, // x, y,
                    -100,
                    100, // x, y,
                ],
                aUV: [0, 0, 1, 0, 1, 1, 0, 1],
            },
        });
        this.body = Bodies.rectangle(width/2,height-60,width,100, { isStatic: true });
    }

    async create(parent: Container, engine: Composite) {
        this.shader = new Shader({
            glProgram,
            resources: {
                uniforms: {
                    iTime: {value: performance.now() / 1000, type: 'f32' },
                }
            }
        });
        const waterMesh = new Mesh({
            geometry: this.geometry,
            shader: this.shader,
        });
        waterMesh.position.set(400, 300);
        waterMesh.width = this.width;
        waterMesh.height = this.height;
        waterMesh.scale.set(2);
        parent.addChild(waterMesh);
        Composite.add(engine, this.body);
    }

    update(): void {
        if (!this.shader) {
            return;
        }
        // this.shader.resources['iTime'] = performance.now() / 1000;
    }

    destroy(): void {
        this.shader?.destroy();
    }
}