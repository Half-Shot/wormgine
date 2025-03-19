import {
  Container,
  Filter,
  Geometry,
  Mesh,
  Shader,
  UPDATE_PRIORITY,
} from "pixi.js";
import { IPhysicalEntity } from "./entity";
import {
  collisionGroupBitmask,
  CollisionGroups,
  GameWorld,
  PIXELS_PER_METER,
  RapierPhysicsObject,
} from "../world";
import { ColliderDesc, Cuboid, RigidBodyDesc } from "@dimforge/rapier2d-compat";
import { MetersValue } from "../utils";

/**
 * Water for the bottom of the game world. Should collide with any objects that fall off the terrain
 * and insta-kill them.
 */
export class Water implements IPhysicalEntity {
  private static readonly collisionBitmask = collisionGroupBitmask(
    CollisionGroups.Terrain,
    [CollisionGroups.WorldObjects],
  );
  priority = UPDATE_PRIORITY.LOW;
  private readonly geometry: Geometry;
  private readonly waterMesh: Mesh<Geometry, Shader>;

  // Never active.
  consideredActive = false;

  public get destroyed() {
    // Water cannot be destroyed
    return false;
  }

  public get body() {
    return this.physObject.body;
  }

  private static vertexSrc: string;
  private static fragmentSrc: string;

  static async readAssets() {
    Water.vertexSrc = (await import("../shaders/water.vert?raw")).default;
    Water.fragmentSrc = (await import("../shaders/water.frag?raw")).default;
  }

  public readonly physObject: RapierPhysicsObject;
  private readonly shader: Shader;

  public get waterHeight(): MetersValue {
    return this.height;
  }

  constructor(
    private readonly width: MetersValue,
    private readonly height: MetersValue,
    world: GameWorld,
  ) {
    const indexBuffer = ["a", "b"].flatMap((_v, i) => {
      i = i * 3;
      if (i === 0) {
        return [i, i + 1, i + 2, i, i + 2, i + 3];
      } else {
        return [i, i - 1, i + 1, i, i + 1, i + 2];
      }
    });
    this.geometry = new Geometry({
      attributes: {
        aPosition: [
          -100,
          0, // top left
          -100,
          100, // bottom left
          0,
          100, // bottom middle
          0,
          0, // top middle
          100,
          100, // bottom right
          100,
          0, // top right
        ],
      },
      indexBuffer,
    });
    this.shader = Filter.from({
      gl: {
        vertex: Water.vertexSrc,
        fragment: Water.fragmentSrc,
        name: "water",
      },
      resources: {
        waveUniforms: {
          iTime: { type: "f32", value: 0 },
        },
      },
    });
    this.physObject = world.createRigidBodyCollider(
      ColliderDesc.cuboid(width.value / 10, 6).setSensor(true),
      // .setCollisionGroups(Water.collisionBitmask)
      // .setSolverGroups(Water.collisionBitmask),
      RigidBodyDesc.fixed().setTranslation(0, height.value),
    );
    const meshPos = this.physObject.body.translation();
    const meshHeight = 6.5;
    this.waterMesh = new Mesh({
      geometry: this.geometry,
      shader: this.shader,
      position: {
        x: width.pixels / 6,
        y: (meshPos.y - meshHeight) * PIXELS_PER_METER,
      },
      visible: true,
    });
    this.waterMesh.width = this.width.value;
    this.waterMesh.height = this.height.value;
    this.waterMesh.scale.set(40, 3.5);
  }

  addToWorld(parent: Container, world: GameWorld) {
    parent.addChildAt(this.waterMesh, Math.max(0, parent.children.length - 1));
    world.addBody(this, this.physObject.collider);
    world.waterYPosition =
      this.body.translation().y -
      (this.physObject.collider.shape as Cuboid).halfExtents.y;
  }

  update(): void {
    this.shader.resources.waveUniforms.uniforms.iTime =
      performance.now() / 1000;
  }

  destroy(): void {
    this.shader.destroy();
  }
}
