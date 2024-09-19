import { Container, Filter, Geometry, Mesh, Shader, UPDATE_PRIORITY } from "pixi.js";
import { IGameEntity } from "./entity";
import vertex from '../shaders/water.vert?raw';
import fragment from '../shaders/water.frag?raw';
import { GameWorld, RapierPhysicsObject } from "../world";
import { ColliderDesc, RigidBodyDesc } from "@dimforge/rapier2d";

export class Water implements IGameEntity {
    public readonly priority: UPDATE_PRIORITY = UPDATE_PRIORITY.LOW;
    private readonly geometry: Geometry;
    private readonly waterMesh: Mesh<Geometry, Shader>;
    public get destroyed() {
        return false;
    }

    private readonly body: RapierPhysicsObject;
    private readonly shader: Shader;

    constructor(private readonly width: number, private readonly height: number, world: GameWorld) {
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
        // TODO: Potentially optimise into a polyline?
        this.body = world.createRigidBodyCollider(ColliderDesc.cuboid(width/2, 100), RigidBodyDesc.fixed().setTranslation(width/2, height-60))
        this.waterMesh = new Mesh({
            geometry: this.geometry,
            shader: this.shader,
            position: {x: this.width/2, y: 1050}
        });
        this.waterMesh.width = this.width;
        this.waterMesh.height = this.height;
        this.waterMesh.scale.set(14, 2);
    }

    async create(parent: Container, world: GameWorld) {
        parent.addChild(this.waterMesh);
        world.addBody(this, this.body.collider);
    }

    update(): void {
        this.shader.resources.waveUniforms.uniforms.iTime = performance.now() / 1000;
    }

    destroy(): void {
        this.shader.destroy();
    }
}