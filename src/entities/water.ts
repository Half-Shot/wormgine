import { Composite, Body, Bodies } from "matter-js";
import { Container, Filter, Geometry, GlProgram, Mesh, Shader, UPDATE_PRIORITY } from "pixi.js";
import { IGameEntity } from "./entity";
import vertex from '../shaders/water.vert?raw';
import fragment from '../shaders/water.frag?raw';

export class Water implements IGameEntity {
    public readonly priority: UPDATE_PRIORITY = UPDATE_PRIORITY.LOW;
    private readonly geometry: Geometry;
    private readonly waterMesh: Mesh<Geometry, Shader>;
    public get destroyed() {
        return false;
    }

    private readonly body: Body;
    private readonly shader: Shader;

    entityOwnsBody(bodyId: number): boolean {
        return this.body?.id === bodyId;
    }

    constructor(private readonly width: number, private readonly height: number) {
        const indexBuffer = ['a','b'].flatMap((_v, i) => {
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
        console.log(indexBuffer);
        this.geometry = new Geometry({
            attributes: {
                aPosition: [
                    -100, -50, // top left
                    -100, 50, // bottom left
                    0, 50, // bottom middle
                    0, -50, // top middle
                    100, 50, // bottom right
                    100, -50, // top right
                ],
            },
            indexBuffer,
        });
        this.shader = Filter.from({
            gl: {vertex, fragment, name: 'water'},
            resources: {
                waveUniforms: {
                    iTime: { type: 'f32', value: 0 },
                }
            }
        });
        this.body = Bodies.rectangle(width/2,height-60,width,100, { isStatic: true });
        this.waterMesh = new Mesh({
            geometry: this.geometry,
            shader: this.shader,
            position: {x: this.width/2, y: 1050}
        });
        this.waterMesh.width = this.width;
        this.waterMesh.height = this.height;
        this.waterMesh.scale.set(14, 2);
    }

    async create(parent: Container, engine: Composite) {
        parent.addChild(this.waterMesh);
        Composite.add(engine, this.body);
    }

    update(): void {
        this.shader.resources.waveUniforms.uniforms.iTime = performance.now() / 1000;
    }

    destroy(): void {
        this.shader.destroy();
    }
}